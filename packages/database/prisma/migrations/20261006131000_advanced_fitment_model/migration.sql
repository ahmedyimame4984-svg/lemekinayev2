-- Advanced fitment dimensions for canonical Manufacturer Articles.
ALTER TABLE "vehicle_compatibilities"
  ADD COLUMN "steering_side" "VehicleSteeringSide",
  ADD COLUMN "drive_type" VARCHAR(40);

CREATE INDEX "vehicle_compatibilities_steering_side_drive_type_idx"
ON "vehicle_compatibilities" ("steering_side", "drive_type");
