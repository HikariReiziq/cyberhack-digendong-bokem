import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const resSlots = await pool.query('SELECT id, zone, row, col, occupied FROM slots ORDER BY id ASC');
    const resInventory = await pool.query('SELECT id, name, qty, unit, category, expiry, status, location FROM inventory WHERE location IS NOT NULL');

    const inventoryByLocation = {};
    resInventory.rows.forEach(inv => {
      if (!inventoryByLocation[inv.location]) inventoryByLocation[inv.location] = [];
      inventoryByLocation[inv.location].push({
        id: inv.id,
        name: inv.name,
        qty: parseFloat(inv.qty),
        unit: inv.unit,
        category: inv.category,
        expiry: inv.expiry ? inv.expiry.toISOString().split('T')[0] : null,
        status: inv.status
      });
    });

    const slots = resSlots.rows.map(row => {
      const items = inventoryByLocation[row.id] || [];
      return {
        id: row.id,
        zone: row.zone,
        row: row.row,
        col: parseInt(row.col),
        occupied: items.length > 0,
        materials: items,
        // Backward compatibility properties for simple single-item checks if any remain
        itemId: items.length > 0 ? items[0].id : null,
        item: items.length > 0 ? items[0] : null
      };
    });

    return NextResponse.json({ success: true, slots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { id, item } = await request.json(); 
    if (!id || !item || !item.id) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Update the inventory item's location to the selected slot
    await pool.query('UPDATE inventory SET location = $1, zone = (SELECT zone FROM slots WHERE id = $1) WHERE id = $2', [id, item.id]);
    
    // Mark slot as occupied
    await pool.query('UPDATE slots SET occupied = true WHERE id = $1', [id]);

    return await GET();
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
