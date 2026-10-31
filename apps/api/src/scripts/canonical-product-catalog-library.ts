export interface CanonicalProductTypeSpec {
  code: string;
  name: string;
  description?: string;
}

export interface CanonicalPartGroupSpec {
  code: string;
  name: string;
  description: string;
  productTypes: readonly CanonicalProductTypeSpec[];
}

export interface CanonicalCategorySpec {
  code: string;
  name: string;
  description: string;
  partGroups: readonly CanonicalPartGroupSpec[];
}

const pt = (
  code: string,
  name: string,
  description?: string,
): CanonicalProductTypeSpec => ({ code, name, description });

const pg = (
  code: string,
  name: string,
  description: string,
  productTypes: readonly CanonicalProductTypeSpec[],
): CanonicalPartGroupSpec => ({ code, name, description, productTypes });

export const CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG:
  readonly CanonicalCategorySpec[] = [
  {
    code: 'CAT_BRAKES',
    name: 'Brakes',
    description:
      'Friction, hydraulic, parking-brake and electronic brake system replacement parts.',
    partGroups: [
      pg('PG_DISC_BRAKES', 'Disc Brake Components', 'Disc brake friction and actuation components.', [
        pt('BRAKE_DISC', 'Brake Disc'),
        pt('BRAKE_PAD', 'Brake Pad Set'),
        pt('BRAKE_CALIPER', 'Brake Caliper'),
        pt('BRAKE_CALIPER_REPAIR_KIT', 'Brake Caliper Repair Kit'),
        pt('BRAKE_PAD_WEAR_SENSOR', 'Brake Pad Wear Sensor'),
        pt('BRAKE_DISC_BACKING_PLATE', 'Brake Disc Backing Plate'),
        pt('BRAKE_CALIPER_BRACKET', 'Brake Caliper Bracket'),
        pt('BRAKE_CALIPER_SLIDER_KIT', 'Brake Caliper Slider Kit'),
      ]),
      pg('PG_DRUM_BRAKES', 'Drum Brake Components', 'Drum brake friction, adjustment and wheel-end hydraulic components.', [
        pt('BRAKE_DRUM', 'Brake Drum'),
        pt('BRAKE_SHOE', 'Brake Shoe Set'),
        pt('WHEEL_CYLINDER', 'Brake Wheel Cylinder'),
        pt('BRAKE_SHOE_ADJUSTER', 'Brake Shoe Adjuster'),
        pt('BRAKE_HARDWARE_KIT', 'Brake Hardware Kit'),
        pt('BRAKE_SHOE_SPRING_KIT', 'Brake Shoe Spring Kit'),
      ]),
      pg('PG_BRAKE_HYDRAULICS', 'Brake Hydraulics & Boosting', 'Hydraulic pressure generation, hoses, pipes and brake assist components.', [
        pt('BRAKE_MASTER_CYLINDER', 'Brake Master Cylinder'),
        pt('BRAKE_HOSE', 'Brake Hose'),
        pt('BRAKE_PIPE', 'Brake Pipe'),
        pt('BRAKE_BOOSTER', 'Brake Booster'),
        pt('BRAKE_VACUUM_PUMP', 'Brake Vacuum Pump'),
        pt('BRAKE_PRESSURE_REGULATOR', 'Brake Pressure Regulator'),
        pt('ABS_HYDRAULIC_UNIT', 'ABS Hydraulic Unit'),
        pt('ABS_PUMP', 'ABS Pump'),
      ]),
      pg('PG_PARKING_BRAKE', 'Parking Brake', 'Mechanical and electric parking-brake components.', [
        pt('PARKING_BRAKE_CABLE', 'Parking Brake Cable'),
        pt('PARKING_BRAKE_SHOE', 'Parking Brake Shoe'),
        pt('PARKING_BRAKE_LEVER', 'Parking Brake Lever'),
        pt('ELECTRIC_PARKING_BRAKE_ACTUATOR', 'Electric Parking Brake Actuator'),
        pt('PARKING_BRAKE_SWITCH', 'Parking Brake Switch'),
      ]),
    ],
  },
  {
    code: 'CAT_FILTERS',
    name: 'Filters',
    description:
      'Engine, cabin, fuel, transmission and hydraulic filtration products and housings.',
    partGroups: [
      pg('PG_ENGINE_FILTERS', 'Engine Filters', 'Service filtration for engine lubrication, intake and fuel systems.', [
        pt('OIL_FILTER', 'Oil Filter'),
        pt('AIR_FILTER', 'Air Filter'),
        pt('FUEL_FILTER', 'Fuel Filter'),
        pt('SECONDARY_AIR_FILTER', 'Secondary Air Filter'),
        pt('CRANKCASE_VENT_FILTER', 'Crankcase Vent Filter'),
      ]),
      pg('PG_CABIN_FILTERS', 'Cabin Filters', 'Passenger-compartment air filtration.', [
        pt('CABIN_FILTER', 'Cabin Air Filter'),
        pt('ACTIVATED_CARBON_CABIN_FILTER', 'Activated Carbon Cabin Filter'),
        pt('ANTI_ALLERGEN_CABIN_FILTER', 'Anti-Allergen Cabin Filter'),
      ]),
      pg('PG_TRANSMISSION_HYDRAULIC_FILTERS', 'Transmission & Hydraulic Filters', 'Filtration for transmission and hydraulic circuits.', [
        pt('TRANSMISSION_FILTER', 'Transmission Filter'),
        pt('HYDRAULIC_FILTER', 'Hydraulic Filter'),
        pt('POWER_STEERING_FILTER', 'Power Steering Filter'),
      ]),
      pg('PG_FILTER_HOUSINGS', 'Filter Housings & Service Parts', 'Filter housings, caps, adapters and related service components.', [
        pt('OIL_FILTER_HOUSING', 'Oil Filter Housing'),
        pt('OIL_FILTER_HOUSING_CAP', 'Oil Filter Housing Cap'),
        pt('AIR_FILTER_HOUSING', 'Air Filter Housing'),
        pt('FUEL_FILTER_HOUSING', 'Fuel Filter Housing'),
        pt('FILTER_HOUSING_GASKET', 'Filter Housing Gasket'),
      ]),
    ],
  },
  {
    code: 'CAT_ENGINE',
    name: 'Engine',
    description:
      'Internal engine, cylinder-head, lubrication, mounting and crankcase components.',
    partGroups: [
      pg('PG_PISTONS_CRANKSHAFT', 'Pistons, Crankshaft & Bearings', 'Bottom-end rotating assembly and bearing components.', [
        pt('PISTON', 'Piston'),
        pt('PISTON_RING_SET', 'Piston Ring Set'),
        pt('CONNECTING_ROD', 'Connecting Rod'),
        pt('CRANKSHAFT', 'Crankshaft'),
        pt('CRANKSHAFT_PULLEY', 'Crankshaft Pulley'),
        pt('MAIN_BEARING_SET', 'Main Bearing Set'),
        pt('CONNECTING_ROD_BEARING_SET', 'Connecting Rod Bearing Set'),
        pt('THRUST_WASHER_SET', 'Crankshaft Thrust Washer Set'),
      ]),
      pg('PG_CYLINDER_HEAD_VALVETRAIN', 'Cylinder Head & Valvetrain', 'Cylinder head, camshaft, valve and rocker components.', [
        pt('CYLINDER_HEAD', 'Cylinder Head'),
        pt('CAMSHAFT', 'Camshaft'),
        pt('ENGINE_VALVE', 'Engine Valve'),
        pt('VALVE_GUIDE', 'Valve Guide'),
        pt('VALVE_LIFTER', 'Valve Lifter / Tappet'),
        pt('ROCKER_ARM', 'Rocker Arm'),
        pt('VALVE_SPRING', 'Valve Spring'),
        pt('CAMSHAFT_ADJUSTER', 'Camshaft Adjuster'),
      ]),
      pg('PG_ENGINE_LUBRICATION', 'Engine Lubrication', 'Oil circulation, storage, cooling and pressure monitoring components.', [
        pt('OIL_PUMP', 'Engine Oil Pump'),
        pt('OIL_PAN', 'Oil Pan / Sump'),
        pt('OIL_PICKUP_TUBE', 'Oil Pickup Tube'),
        pt('OIL_COOLER', 'Engine Oil Cooler'),
        pt('OIL_PRESSURE_SWITCH', 'Oil Pressure Switch'),
        pt('OIL_PRESSURE_SENSOR', 'Oil Pressure Sensor'),
        pt('OIL_FILLER_CAP', 'Oil Filler Cap'),
        pt('DRAIN_PLUG', 'Oil Drain Plug'),
        pt('DRAIN_PLUG_WASHER', 'Oil Drain Plug Washer'),
      ]),
      pg('PG_ENGINE_MOUNTS', 'Engine & Powertrain Mounts', 'Mounting and vibration-isolation components for engine and transmission.', [
        pt('ENGINE_MOUNT', 'Engine Mount'),
        pt('TRANSMISSION_MOUNT', 'Transmission Mount'),
        pt('TORQUE_MOUNT', 'Engine Torque Mount'),
        pt('ENGINE_MOUNT_BRACKET', 'Engine Mount Bracket'),
      ]),
      pg('PG_CRANKCASE_VENTILATION', 'Crankcase Ventilation', 'Positive crankcase ventilation and oil-separation components.', [
        pt('PCV_VALVE', 'PCV Valve'),
        pt('CRANKCASE_BREATHER_HOSE', 'Crankcase Breather Hose'),
        pt('OIL_SEPARATOR', 'Oil Separator'),
        pt('CRANKCASE_BREATHER_ASSEMBLY', 'Crankcase Breather Assembly'),
      ]),
      pg('PG_ENGINE_CORE_HARDWARE', 'Engine Core Hardware', 'Core plugs, bolts and structural engine hardware.', [
        pt('CYLINDER_HEAD_BOLT_SET', 'Cylinder Head Bolt Set'),
        pt('FLYWHEEL_BOLT_SET', 'Flywheel Bolt Set'),
        pt('CORE_PLUG', 'Engine Core Plug'),
        pt('ENGINE_BLOCK', 'Engine Block'),
      ]),
    ],
  },
  {
    code: 'CAT_IGNITION_PREHEATING',
    name: 'Ignition & Preheating',
    description:
      'Gasoline ignition and diesel cold-start/preheating components.',
    partGroups: [
      pg('PG_SPARK_IGNITION', 'Spark Ignition', 'Spark generation, distribution and ignition-control components.', [
        pt('SPARK_PLUG', 'Spark Plug'),
        pt('IGNITION_COIL', 'Ignition Coil'),
        pt('IGNITION_WIRE_SET', 'Ignition Wire Set'),
        pt('DISTRIBUTOR_CAP', 'Distributor Cap'),
        pt('DISTRIBUTOR_ROTOR', 'Distributor Rotor'),
        pt('IGNITION_MODULE', 'Ignition Module'),
        pt('IGNITION_CONDENSER', 'Ignition Condenser'),
      ]),
      pg('PG_DIESEL_PREHEAT', 'Diesel Preheating', 'Glow-plug and diesel cold-start control components.', [
        pt('GLOW_PLUG', 'Glow Plug'),
        pt('GLOW_PLUG_RELAY', 'Glow Plug Relay'),
        pt('GLOW_PLUG_CONTROL_MODULE', 'Glow Plug Control Module'),
        pt('GLOW_PLUG_WIRING_HARNESS', 'Glow Plug Wiring Harness'),
      ]),
    ],
  },
  {
    code: 'CAT_FUEL_AIR',
    name: 'Fuel Supply & Air Intake',
    description:
      'Fuel delivery, injection, intake-air metering and forced-induction components.',
    partGroups: [
      pg('PG_FUEL_DELIVERY', 'Fuel Delivery', 'Fuel storage, transfer, pressure and delivery components.', [
        pt('FUEL_PUMP', 'Fuel Pump'),
        pt('IN_TANK_FUEL_PUMP', 'In-Tank Fuel Pump'),
        pt('HIGH_PRESSURE_FUEL_PUMP', 'High Pressure Fuel Pump'),
        pt('FUEL_PRESSURE_REGULATOR', 'Fuel Pressure Regulator'),
        pt('FUEL_TANK', 'Fuel Tank'),
        pt('FUEL_TANK_CAP', 'Fuel Tank Cap'),
        pt('FUEL_LEVEL_SENSOR', 'Fuel Level Sensor'),
        pt('FUEL_PUMP_CONTROL_MODULE', 'Fuel Pump Control Module'),
      ]),
      pg('PG_FUEL_INJECTION', 'Fuel Injection', 'Fuel injectors, rails and injector service components.', [
        pt('FUEL_INJECTOR', 'Fuel Injector'),
        pt('INJECTOR_NOZZLE', 'Injector Nozzle'),
        pt('INJECTOR_SEAL_KIT', 'Injector Seal Kit'),
        pt('FUEL_RAIL', 'Fuel Rail'),
        pt('FUEL_RAIL_PRESSURE_SENSOR', 'Fuel Rail Pressure Sensor'),
        pt('INJECTOR_RETURN_LINE', 'Injector Return Line'),
      ]),
      pg('PG_AIR_INTAKE', 'Air Intake & Throttle', 'Intake manifold, throttle and intake-air measurement components.', [
        pt('THROTTLE_BODY', 'Throttle Body'),
        pt('INTAKE_MANIFOLD', 'Intake Manifold'),
        pt('AIR_INTAKE_HOSE', 'Air Intake Hose'),
        pt('MASS_AIR_FLOW_SENSOR', 'Mass Air Flow Sensor'),
        pt('MAP_SENSOR', 'Manifold Absolute Pressure Sensor'),
        pt('THROTTLE_POSITION_SENSOR', 'Throttle Position Sensor'),
        pt('IDLE_AIR_CONTROL_VALVE', 'Idle Air Control Valve'),
        pt('INTAKE_MANIFOLD_RUNNER_CONTROL', 'Intake Manifold Runner Control'),
      ]),
      pg('PG_TURBOCHARGING', 'Turbocharging & Intercooling', 'Turbocharger, boost-control and charge-air cooling components.', [
        pt('TURBOCHARGER', 'Turbocharger'),
        pt('TURBO_ACTUATOR', 'Turbocharger Actuator'),
        pt('TURBO_WASTEGATE', 'Turbo Wastegate'),
        pt('INTERCOOLER', 'Intercooler'),
        pt('INTERCOOLER_HOSE', 'Intercooler Hose'),
        pt('TURBO_OIL_LINE', 'Turbo Oil Line'),
        pt('TURBO_COOLANT_LINE', 'Turbo Coolant Line'),
        pt('BOOST_PRESSURE_SENSOR', 'Boost Pressure Sensor'),
      ]),
    ],
  },
  {
    code: 'CAT_COOLING',
    name: 'Engine Cooling',
    description:
      'Engine heat-management, coolant circulation and cooling-fan components.',
    partGroups: [
      pg('PG_RADIATOR_COOLANT', 'Radiator & Coolant Circuit', 'Radiator, coolant reservoir, hoses and pressure-control components.', [
        pt('RADIATOR', 'Radiator'),
        pt('COOLANT_EXPANSION_TANK', 'Coolant Expansion Tank'),
        pt('RADIATOR_CAP', 'Radiator Cap'),
        pt('COOLANT_HOSE', 'Coolant Hose'),
        pt('RADIATOR_HOSE', 'Radiator Hose'),
        pt('HEATER_HOSE', 'Heater Hose'),
        pt('COOLANT_FLANGE', 'Coolant Flange'),
      ]),
      pg('PG_WATER_PUMP_THERMOSTAT', 'Water Pump & Thermostat', 'Coolant circulation and thermostat control components.', [
        pt('WATER_PUMP', 'Water Pump'),
        pt('THERMOSTAT', 'Engine Thermostat'),
        pt('THERMOSTAT_HOUSING', 'Thermostat Housing'),
        pt('AUXILIARY_WATER_PUMP', 'Auxiliary Water Pump'),
        pt('COOLANT_CONTROL_VALVE', 'Coolant Control Valve'),
      ]),
      pg('PG_COOLING_FANS', 'Cooling Fans & Control', 'Cooling fan, clutch, shroud and switching components.', [
        pt('COOLING_FAN', 'Cooling Fan'),
        pt('RADIATOR_FAN_ASSEMBLY', 'Radiator Fan Assembly'),
        pt('FAN_CLUTCH', 'Fan Clutch'),
        pt('FAN_SHROUD', 'Fan Shroud'),
        pt('COOLANT_TEMPERATURE_SENSOR', 'Coolant Temperature Sensor'),
        pt('FAN_SWITCH', 'Cooling Fan Switch'),
        pt('FAN_CONTROL_MODULE', 'Cooling Fan Control Module'),
      ]),
    ],
  },
  {
    code: 'CAT_EXHAUST_EMISSIONS',
    name: 'Exhaust & Emissions',
    description:
      'Exhaust routing, aftertreatment, EGR and emission-monitoring components.',
    partGroups: [
      pg('PG_EXHAUST_SYSTEM', 'Exhaust System', 'Manifolds, pipes, flex sections, resonators and silencers.', [
        pt('EXHAUST_MANIFOLD', 'Exhaust Manifold'),
        pt('EXHAUST_PIPE', 'Exhaust Pipe'),
        pt('FLEX_PIPE', 'Exhaust Flex Pipe'),
        pt('RESONATOR', 'Exhaust Resonator'),
        pt('MUFFLER', 'Muffler / Silencer'),
        pt('TAILPIPE', 'Tailpipe'),
        pt('EXHAUST_HANGER', 'Exhaust Hanger'),
        pt('EXHAUST_CLAMP', 'Exhaust Clamp'),
      ]),
      pg('PG_EXHAUST_AFTERTREATMENT', 'Exhaust Aftertreatment', 'Catalyst, particulate-filter and EGR emission-control components.', [
        pt('CATALYTIC_CONVERTER', 'Catalytic Converter'),
        pt('DIESEL_PARTICULATE_FILTER', 'Diesel Particulate Filter'),
        pt('SCR_CATALYST', 'SCR Catalyst'),
        pt('EGR_VALVE', 'EGR Valve'),
        pt('EGR_COOLER', 'EGR Cooler'),
        pt('EGR_PIPE', 'EGR Pipe'),
        pt('SECONDARY_AIR_PUMP', 'Secondary Air Pump'),
      ]),
      pg('PG_EMISSION_SENSORS', 'Emission Sensors', 'Exhaust gas composition, temperature and pressure monitoring sensors.', [
        pt('OXYGEN_SENSOR', 'Oxygen / Lambda Sensor'),
        pt('NOX_SENSOR', 'NOx Sensor'),
        pt('EXHAUST_GAS_TEMPERATURE_SENSOR', 'Exhaust Gas Temperature Sensor'),
        pt('DPF_PRESSURE_SENSOR', 'DPF Differential Pressure Sensor'),
        pt('EGR_POSITION_SENSOR', 'EGR Position Sensor'),
      ]),
    ],
  },
  {
    code: 'CAT_ELECTRICAL',
    name: 'Electrical & Electronics',
    description:
      'Starting, charging, battery, switching, relay and engine-management electrical components.',
    partGroups: [
      pg('PG_STARTING_CHARGING', 'Starting & Charging', 'Battery, starter and charging-system components.', [
        pt('AUTOMOTIVE_BATTERY', 'Automotive Battery'),
        pt('ALTERNATOR', 'Alternator'),
        pt('STARTER_MOTOR', 'Starter Motor'),
        pt('VOLTAGE_REGULATOR', 'Voltage Regulator'),
        pt('ALTERNATOR_RECTIFIER', 'Alternator Rectifier'),
        pt('STARTER_SOLENOID', 'Starter Solenoid'),
      ]),
      pg('PG_FUSES_RELAYS', 'Fuses, Relays & Power Distribution', 'Electrical protection and switching components.', [
        pt('FUSE', 'Automotive Fuse'),
        pt('FUSE_BOX', 'Fuse Box'),
        pt('RELAY', 'Automotive Relay'),
        pt('RELAY_BOX', 'Relay Box'),
        pt('BATTERY_TERMINAL', 'Battery Terminal'),
        pt('BATTERY_CABLE', 'Battery Cable'),
      ]),
      pg('PG_ENGINE_MANAGEMENT_SENSORS', 'Engine Management Sensors', 'Position, knock, pressure and speed sensing components.', [
        pt('CRANKSHAFT_POSITION_SENSOR', 'Crankshaft Position Sensor'),
        pt('CAMSHAFT_POSITION_SENSOR', 'Camshaft Position Sensor'),
        pt('KNOCK_SENSOR', 'Knock Sensor'),
        pt('VEHICLE_SPEED_SENSOR', 'Vehicle Speed Sensor'),
        pt('BAROMETRIC_PRESSURE_SENSOR', 'Barometric Pressure Sensor'),
        pt('ENGINE_CONTROL_MODULE', 'Engine Control Module'),
      ]),
      pg('PG_SWITCHES_CONTROLS', 'Switches & Controls', 'Ignition and vehicle electrical switches.', [
        pt('IGNITION_SWITCH', 'Ignition Switch'),
        pt('BRAKE_LIGHT_SWITCH', 'Brake Light Switch'),
        pt('REVERSE_LIGHT_SWITCH', 'Reverse Light Switch'),
        pt('MULTIFUNCTION_SWITCH', 'Multifunction Column Switch'),
        pt('WINDOW_SWITCH', 'Power Window Switch'),
        pt('DOOR_JAMB_SWITCH', 'Door Jamb Switch'),
      ]),
      pg('PG_WIRING_CONNECTORS', 'Wiring & Connectors', 'Harnesses, connectors and repair wiring.', [
        pt('ENGINE_WIRING_HARNESS', 'Engine Wiring Harness'),
        pt('SENSOR_CONNECTOR', 'Sensor Connector'),
        pt('REPAIR_WIRE', 'Electrical Repair Wire'),
        pt('GROUND_STRAP', 'Ground Strap'),
      ]),
    ],
  },
  {
    code: 'CAT_SUSPENSION_DAMPING',
    name: 'Suspension & Damping',
    description:
      'Ride-control, spring, control-arm and anti-roll components.',
    partGroups: [
      pg('PG_SHOCKS_STRUTS', 'Shock Absorbers & Struts', 'Dampers, struts, mounts and protection components.', [
        pt('SHOCK_ABSORBER', 'Shock Absorber'),
        pt('STRUT_ASSEMBLY', 'Strut Assembly'),
        pt('STRUT_MOUNT', 'Strut Mount'),
        pt('STRUT_BEARING', 'Strut Bearing'),
        pt('SHOCK_DUST_BOOT', 'Shock Dust Boot'),
        pt('BUMP_STOP', 'Suspension Bump Stop'),
        pt('SHOCK_MOUNT', 'Shock Absorber Mount'),
      ]),
      pg('PG_SPRINGS', 'Springs', 'Mechanical and pneumatic suspension spring components.', [
        pt('COIL_SPRING', 'Coil Spring'),
        pt('LEAF_SPRING', 'Leaf Spring'),
        pt('AIR_SPRING', 'Air Spring'),
        pt('TORSION_BAR', 'Torsion Bar'),
        pt('SPRING_SEAT', 'Spring Seat'),
        pt('SPRING_PAD', 'Spring Pad'),
      ]),
      pg('PG_CONTROL_ARMS_JOINTS', 'Control Arms & Ball Joints', 'Suspension links, arms, joints and bushings.', [
        pt('CONTROL_ARM', 'Control Arm'),
        pt('BALL_JOINT', 'Ball Joint'),
        pt('CONTROL_ARM_BUSHING', 'Control Arm Bushing'),
        pt('TRAILING_ARM', 'Trailing Arm'),
        pt('LATERAL_LINK', 'Lateral Link'),
        pt('SUSPENSION_KNUCKLE', 'Steering Knuckle'),
      ]),
      pg('PG_STABILIZER', 'Stabilizer / Anti-Roll Bar', 'Anti-roll bar, link and bushing components.', [
        pt('STABILIZER_LINK', 'Stabilizer Link'),
        pt('STABILIZER_BUSHING', 'Stabilizer Bar Bushing'),
        pt('STABILIZER_BAR', 'Stabilizer Bar'),
      ]),
    ],
  },
  {
    code: 'CAT_STEERING',
    name: 'Steering',
    description:
      'Steering linkage, rack/gear, assist and column components.',
    partGroups: [
      pg('PG_STEERING_LINKAGE', 'Steering Linkage', 'Tie rods and mechanical linkage components.', [
        pt('TIE_ROD_END', 'Tie Rod End'),
        pt('INNER_TIE_ROD', 'Inner Tie Rod'),
        pt('CENTER_LINK', 'Steering Center Link'),
        pt('IDLER_ARM', 'Idler Arm'),
        pt('PITMAN_ARM', 'Pitman Arm'),
        pt('STEERING_DAMPER', 'Steering Damper'),
      ]),
      pg('PG_STEERING_GEAR', 'Steering Rack & Gear', 'Rack, gearbox and rack service components.', [
        pt('STEERING_RACK', 'Steering Rack'),
        pt('STEERING_GEARBOX', 'Steering Gearbox'),
        pt('STEERING_RACK_BOOT', 'Steering Rack Boot'),
        pt('STEERING_RACK_MOUNT', 'Steering Rack Mount'),
        pt('STEERING_RACK_REPAIR_KIT', 'Steering Rack Repair Kit'),
      ]),
      pg('PG_POWER_STEERING', 'Power Steering', 'Hydraulic and electric steering assist components.', [
        pt('POWER_STEERING_PUMP', 'Power Steering Pump'),
        pt('POWER_STEERING_HOSE', 'Power Steering Hose'),
        pt('POWER_STEERING_RESERVOIR', 'Power Steering Reservoir'),
        pt('ELECTRIC_POWER_STEERING_MOTOR', 'Electric Power Steering Motor'),
        pt('STEERING_ANGLE_SENSOR', 'Steering Angle Sensor'),
        pt('STEERING_COLUMN', 'Steering Column'),
      ]),
    ],
  },
  {
    code: 'CAT_WHEELS_TIRES',
    name: 'Wheels & Tires',
    description:
      'Road wheels, tires, wheel hubs, bearings and wheel attachment hardware.',
    partGroups: [
      pg('PG_WHEELS', 'Road Wheels', 'Steel/alloy road wheels and fitment accessories.', [
        pt('ALLOY_WHEEL', 'Alloy Wheel'),
        pt('STEEL_WHEEL', 'Steel Wheel'),
        pt('WHEEL_SPACER', 'Wheel Spacer'),
        pt('WHEEL_CENTERING_RING', 'Wheel Centering Ring'),
        pt('WHEEL_COVER', 'Wheel Cover'),
      ]),
      pg('PG_TIRES', 'Tires', 'Passenger, SUV, light-truck and terrain tire products.', [
        pt('PASSENGER_TIRE', 'Passenger Car Tire'),
        pt('SUV_TRUCK_TIRE', 'SUV / Light Truck Tire'),
        pt('COMMERCIAL_TIRE', 'Commercial Vehicle Tire'),
        pt('ALL_TERRAIN_TIRE', 'All-Terrain Tire'),
        pt('MUD_TERRAIN_TIRE', 'Mud-Terrain Tire'),
        pt('TEMPORARY_SPARE_TIRE', 'Temporary Spare Tire'),
        pt('TIRE_VALVE', 'Tire Valve'),
        pt('TPMS_SENSOR', 'TPMS Sensor'),
      ]),
      pg('PG_WHEEL_HUB_BEARINGS', 'Wheel Hubs & Bearings', 'Wheel-end hubs, bearings and associated hardware.', [
        pt('WHEEL_BEARING', 'Wheel Bearing'),
        pt('WHEEL_HUB', 'Wheel Hub'),
        pt('HUB_BEARING', 'Hub Bearing Assembly'),
        pt('WHEEL_HUB_NUT', 'Wheel Hub Nut'),
        pt('WHEEL_STUD', 'Wheel Stud'),
        pt('WHEEL_NUT', 'Wheel Nut'),
        pt('WHEEL_BOLT', 'Wheel Bolt'),
      ]),
    ],
  },
  {
    code: 'CAT_DRIVETRAIN_AXLES',
    name: 'Drivetrain & Axles',
    description:
      'CV axles, propeller shafts, differentials, axle shafts and 4WD transfer components.',
    partGroups: [
      pg('PG_CV_AXLES', 'CV Axles & Joints', 'Front/rear drive axle and constant-velocity joint components.', [
        pt('CV_AXLE', 'CV Axle / Drive Shaft'),
        pt('CV_JOINT', 'CV Joint'),
        pt('CV_BOOT_KIT', 'CV Boot Kit'),
        pt('CV_AXLE_NUT', 'CV Axle Nut'),
        pt('TRIPOD_JOINT', 'Tripod Joint'),
      ]),
      pg('PG_PROPELLER_SHAFT', 'Propeller Shaft', 'Longitudinal propeller-shaft and universal-joint components.', [
        pt('PROPELLER_SHAFT', 'Propeller Shaft'),
        pt('UNIVERSAL_JOINT', 'Universal Joint'),
        pt('CENTER_SUPPORT_BEARING', 'Propeller Shaft Center Support Bearing'),
        pt('FLEX_DISC', 'Propeller Shaft Flex Disc'),
      ]),
      pg('PG_DIFFERENTIAL_AXLE', 'Differential & Axle', 'Differential, axle shaft and axle housing service components.', [
        pt('DIFFERENTIAL_ASSEMBLY', 'Differential Assembly'),
        pt('DIFFERENTIAL_BEARING', 'Differential Bearing'),
        pt('DIFFERENTIAL_SEAL', 'Differential Seal'),
        pt('AXLE_SHAFT', 'Axle Shaft'),
        pt('AXLE_SEAL', 'Axle Shaft Seal'),
        pt('AXLE_BEARING', 'Axle Bearing'),
      ]),
      pg('PG_TRANSFER_CASE', 'Transfer Case & 4WD', 'Transfer-case and four-wheel-drive engagement components.', [
        pt('TRANSFER_CASE', 'Transfer Case'),
        pt('TRANSFER_CASE_MOTOR', 'Transfer Case Motor'),
        pt('TRANSFER_CASE_CHAIN', 'Transfer Case Chain'),
        pt('TRANSFER_CASE_SEAL', 'Transfer Case Seal'),
        pt('FRONT_AXLE_ACTUATOR', 'Front Axle Actuator'),
      ]),
    ],
  },
  {
    code: 'CAT_CLUTCH_TRANSMISSION',
    name: 'Clutch & Transmission',
    description:
      'Clutch, manual/automatic transmission and gear-selection components.',
    partGroups: [
      pg('PG_CLUTCH', 'Clutch System', 'Clutch friction, release and hydraulic actuation components.', [
        pt('CLUTCH_KIT', 'Clutch Kit'),
        pt('CLUTCH_DISC', 'Clutch Disc'),
        pt('CLUTCH_PRESSURE_PLATE', 'Clutch Pressure Plate'),
        pt('RELEASE_BEARING', 'Clutch Release Bearing'),
        pt('CLUTCH_MASTER_CYLINDER', 'Clutch Master Cylinder'),
        pt('CLUTCH_SLAVE_CYLINDER', 'Clutch Slave Cylinder'),
        pt('DUAL_MASS_FLYWHEEL', 'Dual Mass Flywheel'),
        pt('FLYWHEEL', 'Flywheel'),
        pt('PILOT_BEARING', 'Clutch Pilot Bearing'),
      ]),
      pg('PG_MANUAL_TRANSMISSION', 'Manual Transmission', 'Manual gearbox internal and external service components.', [
        pt('SYNCHRONIZER_RING', 'Synchronizer Ring'),
        pt('TRANSMISSION_BEARING', 'Transmission Bearing'),
        pt('MANUAL_TRANSMISSION_MOUNT', 'Manual Transmission Mount'),
        pt('GEAR_SHIFT_CABLE', 'Gear Shift Cable'),
        pt('GEAR_SHIFT_LINKAGE', 'Gear Shift Linkage'),
        pt('SHIFT_FORK', 'Shift Fork'),
      ]),
      pg('PG_AUTOMATIC_TRANSMISSION', 'Automatic Transmission', 'Automatic gearbox hydraulic, electronic and service components.', [
        pt('TRANSMISSION_OIL_PAN', 'Transmission Oil Pan'),
        pt('TRANSMISSION_SOLENOID', 'Transmission Solenoid'),
        pt('TORQUE_CONVERTER', 'Torque Converter'),
        pt('VALVE_BODY', 'Transmission Valve Body'),
        pt('TRANSMISSION_CONTROL_MODULE', 'Transmission Control Module'),
        pt('TRANSMISSION_COOLER', 'Transmission Oil Cooler'),
      ]),
      pg('PG_TRANSMISSION_CONTROLS', 'Transmission Controls', 'Selector, range and speed-sensing components.', [
        pt('TRANSMISSION_RANGE_SENSOR', 'Transmission Range Sensor'),
        pt('TRANSMISSION_SPEED_SENSOR', 'Transmission Speed Sensor'),
        pt('GEAR_SELECTOR_ASSEMBLY', 'Gear Selector Assembly'),
        pt('SHIFT_SOLENOID', 'Shift Solenoid'),
      ]),
    ],
  },
  {
    code: 'CAT_BELTS_TIMING',
    name: 'Belts, Chains & Pulleys',
    description:
      'Auxiliary drive and engine timing belt/chain components.',
    partGroups: [
      pg('PG_AUXILIARY_DRIVE', 'Auxiliary Belt Drive', 'Accessory drive belts, tensioners and pulleys.', [
        pt('SERPENTINE_BELT', 'Serpentine / Multi-Rib Belt'),
        pt('V_BELT', 'V-Belt'),
        pt('BELT_TENSIONER', 'Belt Tensioner'),
        pt('IDLER_PULLEY', 'Idler Pulley'),
        pt('TENSIONER_PULLEY', 'Tensioner Pulley'),
        pt('OVERRUNNING_ALTERNATOR_PULLEY', 'Overrunning Alternator Pulley'),
      ]),
      pg('PG_TIMING_DRIVE', 'Timing Drive', 'Timing belts, chains, tensioners, guides and sprockets.', [
        pt('TIMING_BELT', 'Timing Belt'),
        pt('TIMING_BELT_KIT', 'Timing Belt Kit'),
        pt('TIMING_CHAIN', 'Timing Chain'),
        pt('TIMING_CHAIN_KIT', 'Timing Chain Kit'),
        pt('TIMING_TENSIONER', 'Timing Tensioner'),
        pt('TIMING_GUIDE', 'Timing Chain Guide'),
        pt('CAMSHAFT_GEAR', 'Camshaft Gear / Sprocket'),
        pt('CRANKSHAFT_GEAR', 'Crankshaft Gear / Sprocket'),
      ]),
    ],
  },
  {
    code: 'CAT_BODY_EXTERIOR',
    name: 'Body & Exterior',
    description:
      'Body panels, mirrors, glass, locks, handles and exterior hardware.',
    partGroups: [
      pg('PG_MIRRORS', 'Mirrors', 'Exterior mirror assemblies, glass and covers.', [
        pt('SIDE_MIRROR_ASSEMBLY', 'Side Mirror Assembly'),
        pt('MIRROR_GLASS', 'Mirror Glass'),
        pt('MIRROR_COVER', 'Mirror Cover'),
        pt('MIRROR_MOTOR', 'Mirror Adjustment Motor'),
        pt('MIRROR_SWITCH', 'Mirror Switch'),
      ]),
      pg('PG_BODY_PANELS', 'Body Panels', 'Primary exterior body panels and trim structures.', [
        pt('FRONT_BUMPER', 'Front Bumper'),
        pt('REAR_BUMPER', 'Rear Bumper'),
        pt('FENDER', 'Fender / Wing'),
        pt('HOOD', 'Hood / Bonnet'),
        pt('DOOR_SHELL', 'Door Shell'),
        pt('TAILGATE', 'Tailgate / Liftgate'),
        pt('GRILLE', 'Radiator Grille'),
        pt('ROCKER_PANEL', 'Rocker Panel / Sill'),
      ]),
      pg('PG_AUTOMOTIVE_GLASS', 'Automotive Glass', 'Windshield and body glazing.', [
        pt('WINDSHIELD', 'Windshield'),
        pt('SIDE_WINDOW_GLASS', 'Side Window Glass'),
        pt('REAR_WINDOW_GLASS', 'Rear Window Glass'),
        pt('QUARTER_GLASS', 'Quarter Glass'),
      ]),
      pg('PG_LOCKS_HANDLES', 'Locks, Latches & Handles', 'Access and closure hardware.', [
        pt('DOOR_HANDLE', 'Door Handle'),
        pt('DOOR_LOCK_ACTUATOR', 'Door Lock Actuator'),
        pt('DOOR_LATCH', 'Door Latch'),
        pt('HOOD_LATCH', 'Hood Latch'),
        pt('TAILGATE_LATCH', 'Tailgate Latch'),
        pt('TRUNK_LOCK', 'Trunk Lock'),
      ]),
      pg('PG_LIFT_SUPPORTS', 'Lift Supports', 'Gas springs and lift supports for body closures.', [
        pt('HOOD_STRUT', 'Hood Lift Support'),
        pt('TRUNK_STRUT', 'Trunk Lift Support'),
        pt('TAILGATE_STRUT', 'Tailgate Lift Support'),
      ]),
    ],
  },
  {
    code: 'CAT_LIGHTING',
    name: 'Lighting',
    description:
      'Headlamps, signal lamps, auxiliary lighting, bulbs and lighting-control components.',
    partGroups: [
      pg('PG_HEADLIGHTS', 'Headlights', 'Forward-lighting assemblies, bulbs and control components.', [
        pt('HEADLIGHT_ASSEMBLY', 'Headlight Assembly'),
        pt('HEADLIGHT_BULB', 'Headlight Bulb'),
        pt('HID_BALLAST', 'HID / Xenon Ballast'),
        pt('LED_HEADLIGHT_MODULE', 'LED Headlight Module'),
        pt('HEADLIGHT_LEVEL_SENSOR', 'Headlight Level Sensor'),
        pt('HEADLIGHT_CONTROL_MODULE', 'Headlight Control Module'),
      ]),
      pg('PG_SIGNAL_LIGHTING', 'Signal & Exterior Lamps', 'Rear, fog, indicator and marker lighting.', [
        pt('TAIL_LIGHT_ASSEMBLY', 'Tail Light Assembly'),
        pt('FOG_LIGHT_ASSEMBLY', 'Fog Light Assembly'),
        pt('TURN_SIGNAL_LAMP', 'Turn Signal Lamp'),
        pt('SIDE_MARKER_LAMP', 'Side Marker Lamp'),
        pt('LICENSE_PLATE_LAMP', 'License Plate Lamp'),
        pt('DAYTIME_RUNNING_LIGHT', 'Daytime Running Light'),
      ]),
      pg('PG_INTERIOR_LIGHTING', 'Interior Lighting', 'Cabin and cargo lighting products.', [
        pt('INTERIOR_BULB', 'Interior Bulb'),
        pt('DOME_LIGHT_ASSEMBLY', 'Dome Light Assembly'),
        pt('CARGO_LIGHT_ASSEMBLY', 'Cargo Light Assembly'),
      ]),
    ],
  },
  {
    code: 'CAT_WIPER_WASHER',
    name: 'Wiper & Washer System',
    description:
      'Windshield/rear wiper drive, wiping and washer-fluid delivery components.',
    partGroups: [
      pg('PG_WIPERS', 'Wipers', 'Wiper blades, arms, motors and linkages.', [
        pt('WIPER_BLADE', 'Wiper Blade'),
        pt('WIPER_ARM', 'Wiper Arm'),
        pt('WIPER_MOTOR', 'Wiper Motor'),
        pt('WIPER_LINKAGE', 'Wiper Linkage'),
        pt('WIPER_PIVOT', 'Wiper Pivot'),
      ]),
      pg('PG_WASHERS', 'Washers', 'Washer fluid pumps, reservoirs, nozzles and hoses.', [
        pt('WASHER_PUMP', 'Windshield Washer Pump'),
        pt('WASHER_RESERVOIR', 'Washer Reservoir'),
        pt('WASHER_NOZZLE', 'Washer Nozzle'),
        pt('WASHER_HOSE', 'Washer Hose'),
        pt('HEADLIGHT_WASHER_PUMP', 'Headlight Washer Pump'),
      ]),
    ],
  },
  {
    code: 'CAT_HVAC',
    name: 'Heating, Ventilation & Air Conditioning',
    description:
      'Air-conditioning, heating and cabin-air distribution components.',
    partGroups: [
      pg('PG_AIR_CONDITIONING', 'Air Conditioning', 'Refrigerant compression, condensation, expansion and evaporation components.', [
        pt('AC_COMPRESSOR', 'A/C Compressor'),
        pt('AC_CONDENSER', 'A/C Condenser'),
        pt('AC_EVAPORATOR', 'A/C Evaporator'),
        pt('AC_EXPANSION_VALVE', 'A/C Expansion Valve'),
        pt('AC_RECEIVER_DRIER', 'A/C Receiver Drier'),
        pt('AC_ACCUMULATOR', 'A/C Accumulator'),
        pt('AC_HOSE', 'A/C Hose'),
        pt('AC_PRESSURE_SENSOR', 'A/C Pressure Sensor'),
      ]),
      pg('PG_HEATING', 'Heating', 'Heater core, heater valves and coolant-side cabin heating components.', [
        pt('HEATER_CORE', 'Heater Core'),
        pt('HEATER_CONTROL_VALVE', 'Heater Control Valve'),
        pt('AUXILIARY_HEATER', 'Auxiliary Heater'),
      ]),
      pg('PG_CABIN_AIR_CONTROL', 'Cabin Air Control', 'Blower, resistor, actuator and HVAC control components.', [
        pt('BLOWER_MOTOR', 'Blower Motor'),
        pt('BLOWER_RESISTOR', 'Blower Motor Resistor'),
        pt('BLEND_DOOR_ACTUATOR', 'Blend Door Actuator'),
        pt('HVAC_CONTROL_MODULE', 'HVAC Control Module'),
        pt('CABIN_TEMPERATURE_SENSOR', 'Cabin Temperature Sensor'),
      ]),
    ],
  },
  {
    code: 'CAT_OILS_FLUIDS',
    name: 'Oils & Fluids',
    description:
      'Service lubricants, coolants, hydraulic fluids and emissions consumables.',
    partGroups: [
      pg('PG_ENGINE_OILS', 'Engine Oils', 'Engine lubrication fluids.', [
        pt('ENGINE_OIL', 'Engine Oil'),
        pt('ENGINE_FLUSH', 'Engine Flush'),
      ]),
      pg('PG_TRANSMISSION_FLUIDS', 'Transmission & Gear Oils', 'Automatic/manual transmission and driveline lubricants.', [
        pt('AUTOMATIC_TRANSMISSION_FLUID', 'Automatic Transmission Fluid'),
        pt('MANUAL_TRANSMISSION_OIL', 'Manual Transmission Oil'),
        pt('DIFFERENTIAL_OIL', 'Differential Oil'),
        pt('TRANSFER_CASE_OIL', 'Transfer Case Oil'),
      ]),
      pg('PG_COOLANTS_FLUIDS', 'Coolants & Hydraulic Fluids', 'Cooling, brake, steering and hydraulic service fluids.', [
        pt('ANTIFREEZE_COOLANT', 'Antifreeze / Coolant'),
        pt('BRAKE_FLUID', 'Brake Fluid'),
        pt('POWER_STEERING_FLUID', 'Power Steering Fluid'),
        pt('HYDRAULIC_FLUID', 'Hydraulic Fluid'),
        pt('CLUTCH_FLUID', 'Clutch Fluid'),
      ]),
      pg('PG_EMISSION_CONSUMABLES', 'Emission & Service Consumables', 'Diesel exhaust fluid and vehicle service liquids.', [
        pt('DIESEL_EXHAUST_FLUID', 'Diesel Exhaust Fluid / AdBlue'),
        pt('WINDSHIELD_WASHER_FLUID', 'Windshield Washer Fluid'),
        pt('DISTILLED_WATER', 'Distilled Water'),
      ]),
    ],
  },
  {
    code: 'CAT_GASKETS_SEALS',
    name: 'Gaskets & Seals',
    description:
      'Engine, drivetrain, exhaust and general sealing components.',
    partGroups: [
      pg('PG_ENGINE_GASKETS', 'Engine Gaskets', 'Major engine sealing gaskets and gasket sets.', [
        pt('CYLINDER_HEAD_GASKET', 'Cylinder Head Gasket'),
        pt('VALVE_COVER_GASKET', 'Valve Cover Gasket'),
        pt('OIL_PAN_GASKET', 'Oil Pan Gasket'),
        pt('INTAKE_MANIFOLD_GASKET', 'Intake Manifold Gasket'),
        pt('EXHAUST_MANIFOLD_GASKET', 'Exhaust Manifold Gasket'),
        pt('FULL_GASKET_SET', 'Full Engine Gasket Set'),
        pt('HEAD_GASKET_SET', 'Cylinder Head Gasket Set'),
      ]),
      pg('PG_ENGINE_SEALS', 'Engine Oil Seals', 'Rotating-shaft and engine oil seals.', [
        pt('CRANKSHAFT_SEAL', 'Crankshaft Oil Seal'),
        pt('CAMSHAFT_SEAL', 'Camshaft Oil Seal'),
        pt('VALVE_STEM_SEAL_SET', 'Valve Stem Seal Set'),
        pt('OIL_PUMP_SEAL', 'Oil Pump Seal'),
      ]),
      pg('PG_GENERAL_SEALS', 'General O-Rings & Seals', 'General-purpose automotive sealing components.', [
        pt('O_RING', 'O-Ring'),
        pt('SHAFT_SEAL', 'Shaft Seal'),
        pt('GASKET_SHEET', 'Gasket Sheet'),
        pt('COPPER_SEAL_WASHER', 'Copper Sealing Washer'),
        pt('BONDED_SEAL', 'Bonded Seal'),
      ]),
    ],
  },
  {
    code: 'CAT_INTERIOR_CONTROLS',
    name: 'Interior & Controls',
    description:
      'Interior mechanisms, pedals, controls, instrumentation and convenience components.',
    partGroups: [
      pg('PG_PEDALS_CONTROLS', 'Pedals & Driver Controls', 'Pedal, cable and control mechanisms.', [
        pt('ACCELERATOR_PEDAL', 'Accelerator Pedal'),
        pt('ACCELERATOR_CABLE', 'Accelerator Cable'),
        pt('CLUTCH_PEDAL', 'Clutch Pedal'),
        pt('BRAKE_PEDAL_SWITCH', 'Brake Pedal Switch'),
      ]),
      pg('PG_WINDOW_REGULATORS', 'Windows & Regulators', 'Power/manual window lifting and control components.', [
        pt('WINDOW_REGULATOR', 'Window Regulator'),
        pt('WINDOW_MOTOR', 'Window Motor'),
        pt('WINDOW_CRANK', 'Window Crank'),
      ]),
      pg('PG_INSTRUMENTATION', 'Instrumentation', 'Instrument, gauge and driver information components.', [
        pt('INSTRUMENT_CLUSTER', 'Instrument Cluster'),
        pt('SPEEDOMETER_SENSOR', 'Speedometer Sensor'),
        pt('FUEL_GAUGE_SENDER', 'Fuel Gauge Sender'),
      ]),
      pg('PG_CABIN_HARDWARE', 'Cabin Hardware', 'Seat, console and interior trim mechanisms.', [
        pt('SEAT_ADJUSTER', 'Seat Adjuster'),
        pt('SEAT_SWITCH', 'Seat Switch'),
        pt('GLOVE_BOX_LATCH', 'Glove Box Latch'),
        pt('CENTER_CONSOLE_LATCH', 'Center Console Latch'),
      ]),
    ],
  },
  {
    code: 'CAT_SAFETY_ADAS',
    name: 'Safety & Driver Assistance',
    description:
      'Passive safety, ABS/ESC sensing and driver-assistance sensors/cameras.',
    partGroups: [
      pg('PG_PASSIVE_SAFETY', 'Passive Safety', 'Seat belt and supplemental restraint system components.', [
        pt('SEAT_BELT_ASSEMBLY', 'Seat Belt Assembly'),
        pt('SEAT_BELT_BUCKLE', 'Seat Belt Buckle'),
        pt('AIRBAG_MODULE', 'Airbag Module'),
        pt('AIRBAG_CLOCK_SPRING', 'Airbag Clock Spring'),
        pt('AIRBAG_CONTROL_MODULE', 'Airbag Control Module'),
        pt('IMPACT_SENSOR', 'Airbag Impact Sensor'),
      ]),
      pg('PG_ABS_ESC_SENSORS', 'ABS & Stability Sensors', 'Wheel-speed, yaw and stability-control sensing components.', [
        pt('ABS_WHEEL_SPEED_SENSOR', 'ABS Wheel Speed Sensor'),
        pt('YAW_RATE_SENSOR', 'Yaw Rate Sensor'),
        pt('LATERAL_ACCELERATION_SENSOR', 'Lateral Acceleration Sensor'),
        pt('BRAKE_PRESSURE_SENSOR', 'Brake Pressure Sensor'),
      ]),
      pg('PG_ADAS', 'Driver Assistance Sensors', 'Parking, radar and camera-based driver-assistance components.', [
        pt('PARKING_SENSOR', 'Parking Sensor'),
        pt('REAR_VIEW_CAMERA', 'Rear View Camera'),
        pt('FRONT_CAMERA', 'Forward Camera'),
        pt('RADAR_SENSOR', 'Radar Sensor'),
        pt('BLIND_SPOT_SENSOR', 'Blind Spot Sensor'),
      ]),
    ],
  },
] as const;

export interface CanonicalCatalogFlatStats {
  categories: number;
  partGroups: number;
  productTypes: number;
}

export function canonicalCatalogStats(): CanonicalCatalogFlatStats {
  return {
    categories: CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.length,
    partGroups: CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.reduce(
      (total, category) => total + category.partGroups.length,
      0,
    ),
    productTypes: CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG.reduce(
      (total, category) =>
        total +
        category.partGroups.reduce(
          (partTotal, group) => partTotal + group.productTypes.length,
          0,
        ),
      0,
    ),
  };
}

export function canonicalSlug(code: string): string {
  return code
    .toLowerCase()
    .replace(/^cat_/u, '')
    .replace(/^pg_/u, '')
    .replace(/_/gu, '-');
}

export function validateCanonicalProductCatalog(): string[] {
  const errors: string[] = [];
  const categoryCodes = new Set<string>();
  const partGroupCodes = new Set<string>();
  const productTypeCodes = new Set<string>();
  const slugs = new Set<string>();

  for (const category of CANONICAL_AUTOMOTIVE_PRODUCT_CATALOG) {
    if (categoryCodes.has(category.code)) {
      errors.push(`Duplicate Category code: ${category.code}`);
    }
    categoryCodes.add(category.code);

    const categorySlug = canonicalSlug(category.code);
    if (slugs.has(categorySlug)) {
      errors.push(`Duplicate canonical slug: ${categorySlug}`);
    }
    slugs.add(categorySlug);

    if (category.partGroups.length === 0) {
      errors.push(`Category ${category.code} has no Part Groups`);
    }

    for (const group of category.partGroups) {
      if (partGroupCodes.has(group.code)) {
        errors.push(`Duplicate Part Group code: ${group.code}`);
      }
      partGroupCodes.add(group.code);

      if (group.productTypes.length === 0) {
        errors.push(`Part Group ${group.code} has no Product Types`);
      }

      for (const productType of group.productTypes) {
        if (productTypeCodes.has(productType.code)) {
          errors.push(`Duplicate Product Type code: ${productType.code}`);
        }
        productTypeCodes.add(productType.code);

        const slug = canonicalSlug(productType.code);
        if (slugs.has(slug)) {
          errors.push(`Duplicate canonical slug: ${slug}`);
        }
        slugs.add(slug);

        if (productType.code.length > 50) {
          errors.push(
            `Product Type code exceeds 50 characters: ${productType.code}`,
          );
        }
      }
    }
  }

  return errors;
}

export const CANONICAL_PRODUCT_CATALOG_VALIDATION =
  validateCanonicalProductCatalog();
