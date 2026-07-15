const User = require("../models/User");
const Equipment = require("../models/Equipment");

const seedDatabase = async () => {
  await User.bulkWrite(
    [
      {
        updateOne: {
          filter: { email: "admin@minekeeper.com" },
          update: {
            $setOnInsert: {
              name: "Admin User",
              email: "admin@minekeeper.com",
              username: "admin",
              password: "demo123",
              role: "admin",
              department: "Management",
              status: "Active"
            }
          },
          upsert: true
        }
      },
      {
        updateOne: {
          filter: { email: "user@minekeeper.com" },
          update: {
            $setOnInsert: {
              name: "User Account",
              email: "user@minekeeper.com",
              username: "user",
              password: "demo123",
              role: "user",
              department: "Operations",
              status: "Active"
            }
          },
          upsert: true
        }
      },
      {
        updateOne: {
          filter: { email: "technician@minekeeper.com" },
          update: {
            $setOnInsert: {
              name: "Technician Account",
              email: "technician@minekeeper.com",
              username: "technician",
              password: "demo123",
              role: "technician",
              department: "Maintenance",
              status: "Active"
            }
          },
          upsert: true
        }
      }
    ]
  );

  await Equipment.bulkWrite(
    [
      ["DM-2024-001", "Drill Machine #01", "Drilling", "Zone A - Pit 1", "operational"],
      ["EX-2024-005", "Excavator #05", "Earth Moving", "Zone B - Pit 2", "operational"],
      ["CU-2024-003", "Crusher Unit #03", "Processing", "Processing Plant A", "maintenance"],
      ["CS-2024-001", "Conveyor System #01", "Material Handling", "Processing Plant B", "operational"],
      ["DT-2024-008", "Dump Truck #08", "Hauling", "Parking Yard C", "idle"]
    ].map(([assetId, name, type, location, status]) => ({
      updateOne: {
        filter: { assetId },
        update: {
          $setOnInsert: {
            assetId,
            name,
            type,
            location,
            status,
            assignedTo: "Technician Account",
            notes: "Seeded equipment record"
          }
        },
        upsert: true
      }
    }))
  );
};

module.exports = seedDatabase;
