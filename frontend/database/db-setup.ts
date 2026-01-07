import { type SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // เปิดการใช้งาน Foreign Key เพื่อให้ onDelete: Cascade ทำงาน
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    -- TripPlan
    CREATE TABLE IF NOT EXISTS TripPlan (
      plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_group TEXT NOT NULL, -- SQLite ใช้ TEXT แทน VarChar
      creator_id INTEGER NOT NULL,
      trip_id INTEGER,
      start_plan_date TEXT NOT NULL, -- SQLite เก็บวันที่เป็น ISO8601 string (YYYY-MM-DD)
      end_plan_date TEXT NOT NULL,
      day_of_trip INTEGER NOT NULL,
      creat_at TEXT DEFAULT CURRENT_TIMESTAMP -- เก็บเป็น Timestamp string
    );

    -- TripSchedule
    CREATE TABLE IF NOT EXISTS TripSchedule (
      schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER UNIQUE NOT NULL, -- UNIQUE ตามที่กำหนดใน model
      payload TEXT NOT NULL,           -- SQLite เก็บ Json เป็น TEXT (ต้องใช้ JSON.stringify/parse)
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES TripPlan (plan_id) ON DELETE CASCADE
    );
  `);

  console.log('Local database is already set up and migrated');
}
