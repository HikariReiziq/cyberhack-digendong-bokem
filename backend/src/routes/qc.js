import { Router } from 'express';
import { body } from 'express-validator';
import axios from 'axios';
import pool from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Validation rules
const inspectValidation = [
  body('materialId').notEmpty().withMessage('materialId is required'),
  body('materialType').notEmpty().withMessage('materialType is required')
    .isIn(['fruit', 'raw-material', 'extract', 'powder', 'plant']).withMessage('materialType must be one of: fruit, raw-material, extract, powder, plant'),
  body('result').notEmpty().withMessage('result is required')
    .isIn(['pass', 'fail']).withMessage('result must be "pass" or "fail"'),
  body('confidence').notEmpty().withMessage('confidence is required')
    .isFloat({ min: 0, max: 100 }).withMessage('confidence must be between 0 and 100'),
];

// POST /api/qc/inspect — Submit a QC inspection
router.post('/inspect', requireAuth, validate(inspectValidation), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { imageBase64, materialType, materialId, result, confidence, notes } = req.body;

    if (!materialId || !materialType || !result || confidence === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: materialId, materialType, result, confidence'
      });
    }

    if (!['pass', 'fail'].includes(result)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Result must be "pass" or "fail"'
      });
    }

    if (confidence < 0 || confidence > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Confidence must be between 0 and 100'
      });
    }

    const inspectedBy = req.user?.id || null;

    const insertResult = await client.query(
      `INSERT INTO qc_inspections (material_id, material_type, result, confidence, notes, image, inspected_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [materialId, materialType, result, confidence, notes || null, imageBase64 || null, inspectedBy]
    );

    const inspection = insertResult.rows[0];

    // Create audit trail entry
    const username = req.user?.name || 'System';
    const role = req.user?.role || 'Unknown';
    await client.query(
      'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        new Date().toISOString().replace('T', ' ').substring(0, 16),
        username,
        role,
        'QC Inspection',
        `QC inspection for ${materialType} (${materialId}): ${result.toUpperCase()} (${confidence}% confidence)`,
        'QC'
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      inspection: {
        id: inspection.id,
        materialId: inspection.material_id,
        materialType: inspection.material_type,
        result: inspection.result,
        confidence: parseFloat(inspection.confidence),
        notes: inspection.notes,
        inspectedBy: inspection.inspected_by,
        inspectedAt: inspection.inspected_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating QC inspection:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// GET /api/qc/history — Get inspection history, optionally filtered by materialId
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { materialId } = req.query;

    let queryText = 'SELECT * FROM qc_inspections';
    const params = [];

    if (materialId) {
      params.push(materialId);
      queryText += ` WHERE material_id = $${params.length}`;
    }

    queryText += ' ORDER BY inspected_at DESC';

    const result = await pool.query(queryText, params);

    const inspections = result.rows.map(row => ({
      id: row.id,
      materialId: row.material_id,
      materialType: row.material_type,
      result: row.result,
      confidence: parseFloat(row.confidence),
      notes: row.notes,
      image: row.image,
      inspectedBy: row.inspected_by,
      inspectedAt: row.inspected_at
    }));

    return res.json({ success: true, inspections });
  } catch (error) {
    console.error('Error fetching QC history:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Validation for /analyze
const analyzeValidation = [
  body('imageBase64').notEmpty().withMessage('imageBase64 is required'),
  body('materialId').notEmpty().withMessage('materialId is required'),
  body('materialType').notEmpty().withMessage('materialType is required')
    .isIn(['fruit', 'raw-material', 'extract', 'powder', 'plant']).withMessage('materialType must be one of: fruit, raw-material, extract, powder, plant'),
];

// POST /api/qc/analyze - Roboflow Integration
router.post('/analyze', requireAuth, validate(analyzeValidation), async (req, res) => {
  try {
    const { imageBase64, materialId, materialType, autoSave = true } = req.body;
    
    // Clean base64 string if it has data URI prefix
    let base64Data = imageBase64;
    if (imageBase64.includes('base64,')) {
      base64Data = imageBase64.split('base64,')[1];
    }

    // 1. Call Roboflow Serverless API (Concurrent Models)
    let predictions = [];
    try {
      const plantModelUrl = `https://serverless.roboflow.com/plants-diseases-detection-and-classification/12?api_key=${process.env.ROBOFLOW_API_KEY}`;
      const fruitModelUrl = `https://serverless.roboflow.com/rotten-fruit-detector/3?api_key=${process.env.ROBOFLOW_API_KEY}`;
      
      const [plantResponse, fruitResponse] = await Promise.allSettled([
        axios({ method: "POST", url: plantModelUrl, data: base64Data, headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
        axios({ method: "POST", url: fruitModelUrl, data: base64Data, headers: { "Content-Type": "application/x-www-form-urlencoded" } })
      ]);

      const plantPredictions = plantResponse.status === 'fulfilled' ? (plantResponse.value.data.predictions || []) : [];
      const fruitPredictions = fruitResponse.status === 'fulfilled' ? (fruitResponse.value.data.predictions || []) : [];

      // Filter predictions below 40% confidence and tag their source model
      const validPlant = plantPredictions.filter(p => p.confidence > 0.40).map(p => ({ ...p, modelSource: 'plant' }));
      const validFruit = fruitPredictions.filter(p => p.confidence > 0.40).map(p => ({ ...p, modelSource: 'fruit' }));

      predictions = [...validPlant, ...validFruit];
    } catch (roboflowError) {
      console.error("Roboflow Error:", roboflowError.message);
      throw new Error("Failed to process image with Roboflow Vision API");
    }

    // 2. Logic-based Analysis
    let status = 'ACCEPTED';
    let reason = '';
    const toxicKeywords = ['spot', 'rot', 'rotten', 'blight', 'scab', 'disease', 'mildew', 'rust', 'bad', 'defect'];
    
    // Determine the dominant material type based on predictions
    const plantCount = predictions.filter(p => p.modelSource === 'plant').length;
    const fruitCount = predictions.filter(p => p.modelSource === 'fruit').length;
    
    let actualMaterialType = materialType;
    if (plantCount > fruitCount && plantCount > 0) {
      actualMaterialType = 'plant';
    } else if (fruitCount >= plantCount && fruitCount > 0) {
      actualMaterialType = 'fruit';
    }

    const roboflowClasses = predictions.map(p => p.class);

    // Calculate average confidence
    const totalConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 0), 0);
    const avgConfidence = predictions.length > 0 ? (totalConfidence / predictions.length) * 100 : 0;

    // Check for diseases
    const hasDisease = roboflowClasses.some(className => 
      toxicKeywords.some(keyword => className.toLowerCase().includes(keyword))
    );

    if (predictions.length === 0) {
      status = 'REJECTED';
      reason = 'Material ditolak karena tidak ada objek terdeteksi yang relevan.';
    } else if (hasDisease) {
      status = 'REJECTED';
      reason = `Material ditolak karena terindikasi mengandung defek/penyakit (${roboflowClasses.join(', ')}).`;
    } else {
      status = 'ACCEPTED';
      reason = `Material diterima. Kondisi terpantau sehat (${roboflowClasses.join(', ')}).`;
    }

    const dbResult = status === 'ACCEPTED' ? 'pass' : 'fail';
    const confidence = avgConfidence; // Use actual average confidence

    let inspectionId = null;

    if (autoSave) {
      // 3. Log to Database with transactional safety
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inspectedBy = req.user?.id || null;
        const insertResult = await client.query(
          `INSERT INTO qc_inspections (material_id, material_type, result, confidence, notes, image, inspected_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [materialId, actualMaterialType, dbResult, confidence, reason, imageBase64, inspectedBy]
        );
        inspectionId = insertResult.rows[0].id;

        // Create audit trail entry
        const username = req.user?.name || 'System';
        const role = req.user?.role || 'Unknown';
        await client.query(
          'INSERT INTO audit_logs (timestamp, username, role, action, detail, module) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            new Date().toISOString().replace('T', ' ').substring(0, 16),
            username,
            role,
            'QC AI Analysis',
            `QC AI Analysis for ${actualMaterialType} (${materialId}): ${status} - ${reason}`,
            'QC'
          ]
        );
        await client.query('COMMIT');
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Error during QC autoSave insertion:', dbError);
        throw dbError;
      } finally {
        client.release();
      }
    }

    return res.json({
      success: true,
      data: {
        status,
        reason,
        inspectionId,
        roboflowClasses: roboflowClasses,
        predictions // Send full predictions array for bounding boxes
      }
    });

  } catch (error) {
    console.error('Error in /analyze endpoint:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
