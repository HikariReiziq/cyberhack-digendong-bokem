import { Router } from 'express';
import multer from 'multer';

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_PDF_TYPE = 'application/pdf';

// Use memory storage for multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

// POST /api/floor-plan-upload
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]), async (req, res) => {
  try {
    const imageFile = req.files?.image?.[0];
    const pdfFile = req.files?.pdf?.[0];

    // Validate: at least an image must be provided
    if (!imageFile) {
      return res.status(400).json({ success: false, error: 'An image file is required (PNG, JPG, or WEBP)' });
    }

    // Validate image type
    if (!ACCEPTED_IMAGE_TYPES.includes(imageFile.mimetype)) {
      return res.status(400).json({ success: false, error: 'Unsupported image format. Accepted: PNG, JPG, WEBP' });
    }

    // Validate PDF type if provided
    if (pdfFile && pdfFile.mimetype !== ACCEPTED_PDF_TYPE) {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Only PDF is accepted for metadata' });
    }

    let zones;
    const userApiKey = req.headers['x-gemini-api-key'] || req.headers['x-gemini-key'];

    if (pdfFile) {
      // Enhanced zone extraction: image + PDF combined analysis
      zones = await extractZonesFromImageAndPDF(imageFile.buffer, imageFile.mimetype, pdfFile.buffer, userApiKey);
    } else {
      // Image-only zone detection
      zones = await extractZonesFromImage(imageFile.buffer, imageFile.mimetype, userApiKey);
    }

    return res.json({ success: true, zones });
  } catch (error) {
    console.error('Floor plan upload error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Get the Gemini API key from environment variables.
 * Supports both GEMINI_API_KEY and NEXT_PUBLIC_GEMINI_API_KEY.
 */
function getApiKey(userApiKey) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in environment.');
  }
  return apiKey;
}

/**
 * Parse Gemini response text into a zones array.
 */
function parseZonesFromText(text) {
  // Strip markdown code fences if present
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    // Try to extract array from object
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    // Fallback: try to find a JSON array in the text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { return []; }
    }
    return [];
  }
}

const ZONE_EXTRACTION_PROMPT = `You are an expert floor plan analysis system for a warehouse management application.
Carefully analyze this floor plan image and detect ALL distinct zones, rooms, or areas visible.

For each zone detected, determine:
1. A unique identifier based on visible labels or inferred function (e.g., "A-1", "zone-cold")
2. A descriptive name using any visible text labels, or inferred from the zone's appearance
3. The bounding box position as percentage values (0-100) of image dimensions
4. A theme color category:
   - "blue" for loading, receiving, logistics areas
   - "cyan" for cold storage, refrigerated areas
   - "purple" for preparation, tray setting areas
   - "warm" for hot processing, extraction, or dry storage
   - "green" for general production, QC, labs, offices
   - "hazard" for hazardous material storage, chemical areas

Return ONLY a valid JSON array with no markdown formatting.
Each object must have:
- id: string (unique zone identifier)
- name: string (descriptive name)
- position: object with x, y, width, height as percentage values (0-100)
- theme: string (one of: blue, cyan, purple, warm, green, hazard)

Be precise with positions — they should closely match where zones appear in the image.
If you cannot identify any zones, return an empty array [].`;

const ENHANCED_ZONE_PROMPT = `You are an expert floor plan analysis system for a warehouse management application.
Analyze this floor plan image together with the accompanying PDF document for enhanced zone extraction.
The PDF may contain additional textual information about zones, labels, dimensions, or area designations that complement the visual floor plan.
Combine visual analysis of the image with textual data from the PDF to produce the most accurate zone detection.

For each zone detected, determine:
1. A unique identifier based on visible labels or inferred function
2. A descriptive name using visible text labels from image or PDF
3. The bounding box position as percentage values (0-100) of image dimensions
4. A theme color category:
   - "blue" for loading, receiving, logistics areas
   - "cyan" for cold storage, refrigerated areas
   - "purple" for preparation, tray setting areas
   - "warm" for hot processing, extraction, or dry storage
   - "green" for general production, QC, labs, offices
   - "hazard" for hazardous material storage, chemical areas

Return ONLY a valid JSON array with no markdown formatting.
Each object must have:
- id: string (unique zone identifier)
- name: string (descriptive name)
- position: object with x, y, width, height as percentage values (0-100)
- theme: string (one of: blue, cyan, purple, warm, green, hazard)

Be precise with positions — they should closely match where zones appear in the image.
If you cannot identify any zones, return an empty array [].`;

/**
 * Call Gemini API with model fallback and JSON format enforcement.
 */
async function callGeminiWithFallback(contents, generationConfig = {}, userApiKey) {
  const apiKey = getApiKey(userApiKey);
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            ...generationConfig,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text === undefined || text === null) {
        throw new Error('Empty response');
      }

      return text;
    } catch (err) {
      console.warn(`Model ${model} failed in backend:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed on backend. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Extract zones from an image using Gemini AI.
 */
async function extractZonesFromImage(imageBuffer, mimeType, userApiKey) {
  const base64Image = imageBuffer.toString('base64');
  const contents = [{
    parts: [
      { text: ZONE_EXTRACTION_PROMPT },
      { inlineData: { mimeType, data: base64Image } }
    ]
  }];

  const text = await callGeminiWithFallback(contents, {}, userApiKey);
  return parseZonesFromText(text);
}

/**
 * Extract zones from an image + PDF using Gemini AI for enhanced analysis.
 */
async function extractZonesFromImageAndPDF(imageBuffer, imageMimeType, pdfBuffer, userApiKey) {
  const base64Image = imageBuffer.toString('base64');
  const base64Pdf = pdfBuffer.toString('base64');
  const contents = [{
    parts: [
      { text: ENHANCED_ZONE_PROMPT },
      { inlineData: { mimeType: imageMimeType, data: base64Image } },
      { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
    ]
  }];

  const text = await callGeminiWithFallback(contents, {}, userApiKey);
  return parseZonesFromText(text);
}

export default router;
