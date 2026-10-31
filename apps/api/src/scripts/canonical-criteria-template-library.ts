import { MASTER_ATTRIBUTE_LIBRARY } from './master-attribute-library.js';

export type CanonicalCriteriaRequirement = 'MANDATORY' | 'OPTIONAL';

export interface CanonicalCriteriaTemplateItemSpec {
  attributeCode: string;
  requirement: CanonicalCriteriaRequirement;
  displayOrder: number;
  searchable: boolean;
  filterable: boolean;
  comparable: boolean;
  variantDefining: boolean;
  marketplaceVisible: boolean;
  sellerEditable: boolean;
}

export interface CanonicalCriteriaTemplateSpec {
  code: string;
  name: string;
  description: string;
  targetProductTypeCodes: readonly string[];
  items: readonly CanonicalCriteriaTemplateItemSpec[];
}

type ItemOptions = Partial<
  Omit<CanonicalCriteriaTemplateItemSpec, 'attributeCode' | 'displayOrder'>
>;

function criterion(
  attributeCode: string,
  displayOrder: number,
  options: ItemOptions = {},
): CanonicalCriteriaTemplateItemSpec {
  return {
    attributeCode,
    displayOrder,
    requirement: options.requirement ?? 'OPTIONAL',
    searchable: options.searchable ?? false,
    filterable: options.filterable ?? false,
    comparable: options.comparable ?? false,
    variantDefining: options.variantDefining ?? false,
    marketplaceVisible: options.marketplaceVisible ?? true,
    sellerEditable: options.sellerEditable ?? true,
  };
}

const requiredComparable = (
  attributeCode: string,
  displayOrder: number,
  options: ItemOptions = {},
) =>
  criterion(attributeCode, displayOrder, {
    requirement: 'MANDATORY',
    filterable: true,
    comparable: true,
    ...options,
  });

const optionalComparable = (
  attributeCode: string,
  displayOrder: number,
  options: ItemOptions = {},
) =>
  criterion(attributeCode, displayOrder, {
    filterable: true,
    comparable: true,
    ...options,
  });

export const CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES:
  readonly CanonicalCriteriaTemplateSpec[] = [
  {
    code: 'CANON_BRAKE_DISC_V1',
    name: 'Brake Disc Standard Criteria',
    description:
      'Core brake rotor geometry, installation position, brake-system and approval criteria. Vehicle compatibility remains in structured fitment.',
    targetProductTypeCodes: ['BRAKE_DISC'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      requiredComparable('ATTR_BRAKE_DISC_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BRAKE_DISC_THICKNESS', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BRAKE_DISC_MIN_THICKNESS', 50),
      requiredComparable('ATTR_BRAKE_DISC_HEIGHT', 60),
      requiredComparable('ATTR_BRAKE_DISC_TYPE', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CENTER_BORE', 80),
      optionalComparable('ATTR_BOLT_CIRCLE_DIAMETER', 90, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
      optionalComparable('ATTR_COATING', 110),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 120),
      criterion('ATTR_E_MARK', 130, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 140),
    ],
  },
  {
    code: 'CANON_BRAKE_PAD_V1',
    name: 'Brake Pad Standard Criteria',
    description:
      'Brake pad geometry, friction, wear-sensor and application-position criteria for professional catalog comparison.',
    targetProductTypeCodes: ['BRAKE_PAD'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      requiredComparable('ATTR_BRAKE_PAD_WIDTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BRAKE_PAD_HEIGHT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BRAKE_PAD_THICKNESS', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FRICTION_MATERIAL', 60),
      optionalComparable('ATTR_BRAKE_WEAR_SENSOR', 70),
      criterion('ATTR_BRAKE_PAD_WVA_NUMBER', 80, { searchable: true }),
      criterion('ATTR_BRAKE_PAD_FMSI_NUMBER', 90, { searchable: true }),
      criterion('ATTR_E_MARK', 110, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 120),
    ],
  },
  {
    code: 'CANON_BRAKE_SHOE_V1',
    name: 'Brake Shoe Standard Criteria',
    description:
      'Drum-brake shoe geometry, axle position, friction and brake-system criteria.',
    targetProductTypeCodes: ['BRAKE_SHOE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      requiredComparable('ATTR_BRAKE_DRUM_DIAMETER', 30),
      requiredComparable('ATTR_BRAKE_SHOE_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FRICTION_MATERIAL', 50),
      criterion('ATTR_E_MARK', 60, { filterable: true }),
    ],
  },
  {
    code: 'CANON_BRAKE_CALIPER_V1',
    name: 'Brake Caliper Standard Criteria',
    description:
      'Brake caliper position, hydraulic piston, mounting and brake-system criteria.',
    targetProductTypeCodes: ['BRAKE_CALIPER'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_BRAKE_SYSTEM', 30),
      requiredComparable('ATTR_CALIPER_PISTON_COUNT', 40),
      optionalComparable('ATTR_CALIPER_PISTON_DIAMETER', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
      optionalComparable('ATTR_PORT_COUNT', 70),
      optionalComparable('ATTR_THREAD_SIZE', 80),
      optionalComparable('ATTR_CALIPER_HOLDER_INCLUDED', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_CALIPER_REPAIR_KIT_V1',
    name: 'Brake Caliper Repair Kit Standard Criteria',
    description:
      'Caliper repair-kit application, piston/seal dimensions and supplied-content criteria. Exact vehicle compatibility remains structured fitment.',
    targetProductTypeCodes: ['BRAKE_CALIPER_REPAIR_KIT'],
    items: [
      optionalComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      optionalComparable('ATTR_CALIPER_PISTON_COUNT', 30),
      optionalComparable('ATTR_CALIPER_PISTON_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_BRAKE_PAD_WEAR_SENSOR_V1',
    name: 'Brake Pad Wear Sensor Standard Criteria',
    description:
      'Wear-sensor axle/side, lead length and electrical connection criteria.',
    targetProductTypeCodes: ['BRAKE_PAD_WEAR_SENSOR'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_CABLE_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_TERMINAL_COUNT', 60),
      optionalComparable('ATTR_RESISTANCE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_BRAKE_DISC_BACKING_PLATE_V1',
    name: 'Brake Disc Backing Plate Standard Criteria',
    description:
      'Brake dust-shield/backing-plate position, geometry, material and mounting criteria.',
    targetProductTypeCodes: ['BRAKE_DISC_BACKING_PLATE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CENTER_BORE', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
      optionalComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_COATING', 70),
    ],
  },
  {
    code: 'CANON_BRAKE_CALIPER_BRACKET_V1',
    name: 'Brake Caliper Bracket Standard Criteria',
    description:
      'Caliper-carrier position, mounting geometry, thread and construction criteria.',
    targetProductTypeCodes: ['BRAKE_CALIPER_BRACKET'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20, { variantDefining: true }),
      optionalComparable('ATTR_BRAKE_SYSTEM', 30),
      requiredComparable('ATTR_MOUNTING_HOLE_COUNT', 40),
      optionalComparable('ATTR_HOLE_SPACING', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_COATING', 80),
    ],
  },
  {
    code: 'CANON_BRAKE_CALIPER_SLIDER_KIT_V1',
    name: 'Brake Caliper Slider Kit Standard Criteria',
    description:
      'Caliper slider/guide kit application, guide-pin dimensions, thread and supplied-content criteria.',
    targetProductTypeCodes: ['BRAKE_CALIPER_SLIDER_KIT'],
    items: [
      optionalComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      optionalComparable('ATTR_FASTENER_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FASTENER_LENGTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FASTENER_THREAD', 50),
      optionalComparable('ATTR_PLATING', 60),
    ],
  },
  {
    code: 'CANON_BRAKE_DRUM_V1',
    name: 'Brake Drum Standard Criteria',
    description:
      'Brake-drum working diameter, wear limit, mounting geometry, bearing integration and approval criteria.',
    targetProductTypeCodes: ['BRAKE_DRUM'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_BRAKE_DRUM_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BRAKE_DRUM_MAX_DIAMETER', 30),
      requiredComparable('ATTR_BRAKE_DRUM_HEIGHT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BRAKE_DRUM_WIDTH', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CENTER_BORE', 60),
      optionalComparable('ATTR_BOLT_CIRCLE_DIAMETER', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_WHEEL_BEARING_INCLUDED', 90),
      optionalComparable('ATTR_COATING', 100),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 110),
      criterion('ATTR_E_MARK', 120, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 130),
    ],
  },
  {
    code: 'CANON_WHEEL_CYLINDER_V1',
    name: 'Brake Wheel Cylinder Standard Criteria',
    description:
      'Wheel-cylinder position, bore, hydraulic connection, construction and regulator criteria.',
    targetProductTypeCodes: ['WHEEL_CYLINDER'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_BRAKE_SYSTEM', 30),
      requiredComparable('ATTR_BORE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PORT_COUNT', 50),
      optionalComparable('ATTR_THREAD_SIZE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_INTEGRATED_PRESSURE_REGULATOR', 80),
    ],
  },
  {
    code: 'CANON_BRAKE_SHOE_ADJUSTER_V1',
    name: 'Brake Shoe Adjuster Standard Criteria',
    description:
      'Drum-brake adjuster position, brake-system, adjustment geometry and construction criteria.',
    targetProductTypeCodes: ['BRAKE_SHOE_ADJUSTER'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_BRAKE_SYSTEM', 30),
      optionalComparable('ATTR_BRAKE_DRUM_DIAMETER', 40),
      optionalComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_BRAKE_HARDWARE_KIT_V1',
    name: 'Brake Hardware Kit Standard Criteria',
    description:
      'Drum/disc brake hardware-kit application and supplied-content criteria.',
    targetProductTypeCodes: ['BRAKE_HARDWARE_KIT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      optionalComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_COATING', 60),
    ],
  },
  {
    code: 'CANON_BRAKE_SHOE_SPRING_KIT_V1',
    name: 'Brake Shoe Spring Kit Standard Criteria',
    description:
      'Drum-brake spring-kit application, construction and supplied-content criteria.',
    targetProductTypeCodes: ['BRAKE_SHOE_SPRING_KIT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      optionalComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_COATING', 60),
    ],
  },
  {
    code: 'CANON_BRAKE_MASTER_CYLINDER_V1',
    name: 'Brake Master Cylinder Standard Criteria',
    description:
      'Master-cylinder bore, stroke, hydraulic ports, reservoir and ABS application criteria.',
    targetProductTypeCodes: ['BRAKE_MASTER_CYLINDER'],
    items: [
      optionalComparable('ATTR_BRAKE_SYSTEM', 10),
      requiredComparable('ATTR_BORE_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MASTER_CYLINDER_STROKE', 30),
      requiredComparable('ATTR_PORT_COUNT', 40),
      optionalComparable('ATTR_THREAD_SIZE_1', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE_2', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLUID_RESERVOIR_INCLUDED', 70),
      optionalComparable('ATTR_LENGTH', 90),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_HOSE_V1',
    name: 'Brake Hose Standard Criteria',
    description:
      'Flexible brake-hose length, end connections, threads and installation-position criteria.',
    targetProductTypeCodes: ['BRAKE_HOSE'],
    items: [
      optionalComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_CONNECTION_1', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONNECTION_2', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE_1', 60),
      optionalComparable('ATTR_THREAD_SIZE_2', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
      optionalComparable('ATTR_MATERIAL', 90),
      criterion('ATTR_SAE_STANDARD', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_PIPE_V1',
    name: 'Brake Pipe Standard Criteria',
    description:
      'Rigid brake-line dimensions, end connections, flare standard and material criteria.',
    targetProductTypeCodes: ['BRAKE_PIPE'],
    items: [
      requiredComparable('ATTR_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONNECTION_1', 30),
      requiredComparable('ATTR_CONNECTION_2', 40),
      optionalComparable('ATTR_THREAD_SIZE_1', 50),
      optionalComparable('ATTR_THREAD_SIZE_2', 60),
      requiredComparable('ATTR_BRAKE_PIPE_FLARE_TYPE', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_COATING', 90),
    ],
  },
  {
    code: 'CANON_BRAKE_BOOSTER_V1',
    name: 'Brake Booster Standard Criteria',
    description:
      'Brake-servo architecture, housing size, stroke, mounting, sensor and brake-assist criteria.',
    targetProductTypeCodes: ['BRAKE_BOOSTER'],
    items: [
      optionalComparable('ATTR_BRAKE_SYSTEM', 10),
      requiredComparable('ATTR_BRAKE_BOOSTER_TYPE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BRAKE_BOOSTER_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BRAKE_BOOSTER_STROKE', 40),
      optionalComparable('ATTR_STUD_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_BRAKE_ASSISTANT_INCLUDED', 70),
      optionalComparable('ATTR_VACUUM_SENSOR_INCLUDED', 80),
      optionalComparable('ATTR_POSITION_SENSOR_INCLUDED', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_VACUUM_PUMP_V1',
    name: 'Brake Vacuum Pump Standard Criteria',
    description:
      'Brake vacuum-pump construction, ports, connections, drive/mounting and operating-pressure criteria.',
    targetProductTypeCodes: ['BRAKE_VACUUM_PUMP'],
    items: [
      requiredComparable('ATTR_BRAKE_VACUUM_PUMP_TYPE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_INLET_DIAMETER', 30),
      optionalComparable('ATTR_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_OPERATING_PRESSURE_MIN', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_BRAKE_PRESSURE_REGULATOR_V1',
    name: 'Brake Pressure Regulator Standard Criteria',
    description:
      'Brake pressure regulator hydraulic connections, adjustment range and mounting criteria.',
    targetProductTypeCodes: ['BRAKE_PRESSURE_REGULATOR'],
    items: [
      optionalComparable('ATTR_BRAKE_SYSTEM', 10),
      requiredComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_THREAD_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OPERATING_PRESSURE_MIN', 40),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_ABS_HYDRAULIC_UNIT_V1',
    name: 'ABS Hydraulic Unit Standard Criteria',
    description:
      'ABS hydraulic-control-unit system family, hydraulic ports, electrical interface and supplied-content criteria.',
    targetProductTypeCodes: ['ABS_HYDRAULIC_UNIT'],
    items: [
      requiredComparable('ATTR_BRAKE_SYSTEM', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_ABS_PUMP_V1',
    name: 'ABS Pump Standard Criteria',
    description:
      'ABS pump system family, electrical ratings, hydraulic ports and mounting criteria.',
    targetProductTypeCodes: ['ABS_PUMP'],
    items: [
      requiredComparable('ATTR_BRAKE_SYSTEM', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_PORT_COUNT', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_PARKING_BRAKE_CABLE_V1',
    name: 'Parking Brake Cable Standard Criteria',
    description:
      'Parking-brake cable position, total/casing length, end connections and mounting criteria.',
    targetProductTypeCodes: ['PARKING_BRAKE_CABLE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20, { variantDefining: true }),
      requiredComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_PARKING_BRAKE_CASING_LENGTH', 40),
      requiredComparable('ATTR_CONNECTION_1', 50),
      requiredComparable('ATTR_CONNECTION_2', 60),
      optionalComparable('ATTR_THREAD_SIZE_1', 70),
      optionalComparable('ATTR_THREAD_SIZE_2', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_PARKING_BRAKE_SHOE_V1',
    name: 'Parking Brake Shoe Standard Criteria',
    description:
      'Parking-brake shoe axle, drum geometry, friction material and approval criteria.',
    targetProductTypeCodes: ['PARKING_BRAKE_SHOE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_BRAKE_SYSTEM', 20),
      optionalComparable('ATTR_BRAKE_DRUM_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BRAKE_SHOE_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FRICTION_MATERIAL', 50),
      criterion('ATTR_E_MARK', 60, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 70),
    ],
  },
  {
    code: 'CANON_PARKING_BRAKE_LEVER_V1',
    name: 'Parking Brake Lever Standard Criteria',
    description:
      'Mechanical parking-brake lever geometry, mounting, connection and construction criteria.',
    targetProductTypeCodes: ['PARKING_BRAKE_LEVER'],
    items: [
      optionalComparable('ATTR_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_MOUNTING_TYPE', 20),
      optionalComparable('ATTR_CONNECTION_1', 30),
      optionalComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_FINISH', 50),
    ],
  },
  {
    code: 'CANON_ELECTRIC_PARKING_BRAKE_ACTUATOR_V1',
    name: 'Electric Parking Brake Actuator Standard Criteria',
    description:
      'Electric parking-brake actuator position, electrical interface, output torque and mounting criteria.',
    targetProductTypeCodes: ['ELECTRIC_PARKING_BRAKE_ACTUATOR'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20, { variantDefining: true }),
      requiredComparable('ATTR_VOLTAGE', 30, { variantDefining: true }),
      optionalComparable('ATTR_ACTUATOR_TORQUE', 40),
      optionalComparable('ATTR_CONNECTOR_GENDER', 50),
      optionalComparable('ATTR_PIN_COUNT', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_PARKING_BRAKE_SWITCH_V1',
    name: 'Parking Brake Switch Standard Criteria',
    description:
      'Parking-brake switch operating type, electrical connection and mounting criteria.',
    targetProductTypeCodes: ['PARKING_BRAKE_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 20),
      optionalComparable('ATTR_PIN_COUNT', 30),
      optionalComparable('ATTR_TERMINAL_COUNT', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_OIL_FILTER_V1',
    name: 'Oil Filter Standard Criteria',
    description:
      'Oil-filter construction, sealing geometry, connection, valve and filtration criteria. Engine/vehicle application remains structured fitment.',
    targetProductTypeCodes: ['OIL_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 50),
      requiredComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_SIZE', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_GASKET_INNER_DIAMETER', 80),
      optionalComparable('ATTR_FILTER_GASKET_OUTER_DIAMETER', 90),
      optionalComparable('ATTR_BYPASS_VALVE', 100),
      optionalComparable('ATTR_BYPASS_VALVE_OPENING_PRESSURE', 110),
      optionalComparable('ATTR_ANTI_DRAINBACK_VALVE', 120),
      optionalComparable('ATTR_ANTI_DRAINBACK_VALVE_COUNT', 130),
      optionalComparable('ATTR_ANTI_SIPHON_VALVE', 140),
      optionalComparable('ATTR_MICRON_RATING', 150),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 160),
      optionalComparable('ATTR_FLOW_RATE', 170),
    ],
  },
  {
    code: 'CANON_AIR_FILTER_V1',
    name: 'Air Filter Standard Criteria',
    description:
      'Engine air-filter construction, dimensions, media and airflow criteria.',
    targetProductTypeCodes: ['AIR_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 80),
      optionalComparable('ATTR_MICRON_RATING', 90),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 100),
      optionalComparable('ATTR_FLOW_RATE', 110),
    ],
  },
  {
    code: 'CANON_FUEL_FILTER_V1',
    name: 'Fuel Filter Standard Criteria',
    description:
      'Fuel-filter construction, dimensions, fluid interfaces, water separation and filtration criteria.',
    targetProductTypeCodes: ['FUEL_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 50, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_PORT_COUNT', 70),
      optionalComparable('ATTR_INLET_DIAMETER', 80),
      optionalComparable('ATTR_OUTLET_DIAMETER', 90),
      optionalComparable('ATTR_FILTER_GASKET_INNER_DIAMETER', 100),
      optionalComparable('ATTR_FILTER_GASKET_OUTER_DIAMETER', 110),
      optionalComparable('ATTR_WATER_SEPARATOR', 120),
      optionalComparable('ATTR_WATER_SENSOR_INCLUDED', 130),
      optionalComparable('ATTR_HEATER_INCLUDED', 140),
      optionalComparable('ATTR_MICRON_RATING', 150),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 160),
      optionalComparable('ATTR_FLOW_RATE', 170),
    ],
  },
  {
    code: 'CANON_SECONDARY_AIR_FILTER_V1',
    name: 'Secondary Air Filter Standard Criteria',
    description:
      'Secondary or safety air-filter construction, dimensions, media and airflow criteria.',
    targetProductTypeCodes: ['SECONDARY_AIR_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 80),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 90),
      optionalComparable('ATTR_FLOW_RATE', 100),
    ],
  },
  {
    code: 'CANON_CRANKCASE_VENT_FILTER_V1',
    name: 'Crankcase Vent Filter Standard Criteria',
    description:
      'Crankcase ventilation filter construction, dimensions, media and separation performance criteria.',
    targetProductTypeCodes: ['CRANKCASE_VENT_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 70),
      optionalComparable('ATTR_INSIDE_DIAMETER', 80),
      optionalComparable('ATTR_MICRON_RATING', 90),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 100),
      optionalComparable('ATTR_FLOW_RATE', 110),
    ],
  },
  {
    code: 'CANON_CABIN_FILTER_V1',
    name: 'Cabin Air Filter Standard Criteria',
    description:
      'Passenger-compartment particle filter dimensions, media, treatment and filtration criteria.',
    targetProductTypeCodes: ['CABIN_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CABIN_FILTER_TREATMENT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 40),
      requiredComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      requiredComparable('ATTR_WIDTH', 60, { variantDefining: true }),
      requiredComparable('ATTR_HEIGHT', 70, { variantDefining: true }),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 80),
      optionalComparable('ATTR_FLOW_RATE', 90),
    ],
  },
  {
    code: 'CANON_ACTIVATED_CARBON_CABIN_FILTER_V1',
    name: 'Activated Carbon Cabin Filter Standard Criteria',
    description:
      'Activated-carbon cabin filter dimensions, media, treatment and filtration criteria.',
    targetProductTypeCodes: ['ACTIVATED_CARBON_CABIN_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CABIN_FILTER_TREATMENT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FILTER_MEDIA', 40),
      requiredComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      requiredComparable('ATTR_WIDTH', 60, { variantDefining: true }),
      requiredComparable('ATTR_HEIGHT', 70, { variantDefining: true }),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 80),
      optionalComparable('ATTR_FLOW_RATE', 90),
    ],
  },
  {
    code: 'CANON_ANTI_ALLERGEN_CABIN_FILTER_V1',
    name: 'Anti-Allergen Cabin Filter Standard Criteria',
    description:
      'Anti-allergen cabin filter dimensions, treatment, media and filtration criteria.',
    targetProductTypeCodes: ['ANTI_ALLERGEN_CABIN_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CABIN_FILTER_TREATMENT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 40),
      requiredComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      requiredComparable('ATTR_WIDTH', 60, { variantDefining: true }),
      requiredComparable('ATTR_HEIGHT', 70, { variantDefining: true }),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 80),
      optionalComparable('ATTR_FLOW_RATE', 90),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_FILTER_V1',
    name: 'Transmission Filter Standard Criteria',
    description:
      'Transmission-fluid filter construction, sealing geometry, dimensions, valve and service-kit criteria.',
    targetProductTypeCodes: ['TRANSMISSION_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      requiredComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 80),
      optionalComparable('ATTR_THREAD_SIZE', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_GASKET_INNER_DIAMETER', 100),
      optionalComparable('ATTR_FILTER_GASKET_OUTER_DIAMETER', 110),
      optionalComparable('ATTR_BYPASS_VALVE', 120),
      optionalComparable('ATTR_BYPASS_VALVE_OPENING_PRESSURE', 130),
      optionalComparable('ATTR_ANTI_DRAINBACK_VALVE', 140),
      optionalComparable('ATTR_ANTI_SIPHON_VALVE', 150),
      optionalComparable('ATTR_GASKET_INCLUDED', 160),
      optionalComparable('ATTR_MICRON_RATING', 170),
      optionalComparable('ATTR_FLOW_RATE', 180),
    ],
  },
  {
    code: 'CANON_HYDRAULIC_FILTER_V1',
    name: 'Hydraulic Filter Standard Criteria',
    description:
      'Hydraulic filter construction, dimensions, connection, pressure and filtration criteria.',
    targetProductTypeCodes: ['HYDRAULIC_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 50),
      optionalComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_SIZE', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_GASKET_INNER_DIAMETER', 80),
      optionalComparable('ATTR_FILTER_GASKET_OUTER_DIAMETER', 90),
      optionalComparable('ATTR_BYPASS_VALVE', 100),
      optionalComparable('ATTR_BYPASS_VALVE_OPENING_PRESSURE', 110),
      optionalComparable('ATTR_ANTI_DRAINBACK_VALVE', 120),
      optionalComparable('ATTR_ANTI_SIPHON_VALVE', 130),
      optionalComparable('ATTR_MICRON_RATING', 140),
      optionalComparable('ATTR_FILTRATION_EFFICIENCY', 150),
      optionalComparable('ATTR_FLOW_RATE', 160),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 170),
    ],
  },
  {
    code: 'CANON_POWER_STEERING_FILTER_V1',
    name: 'Power Steering Filter Standard Criteria',
    description:
      'Power-steering fluid filter construction, dimensions, interfaces and filtration criteria.',
    targetProductTypeCodes: ['POWER_STEERING_FILTER'],
    items: [
      requiredComparable('ATTR_FILTER_TYPE', 10),
      requiredComparable('ATTR_FILTER_FORM_FACTOR', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FILTER_MEDIA', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
      optionalComparable('ATTR_PORT_COUNT', 80),
      optionalComparable('ATTR_INLET_DIAMETER', 90),
      optionalComparable('ATTR_OUTLET_DIAMETER', 100),
      optionalComparable('ATTR_MICRON_RATING', 110),
      optionalComparable('ATTR_FLOW_RATE', 120),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 130),
    ],
  },
  {
    code: 'CANON_OIL_FILTER_HOUSING_V1',
    name: 'Oil Filter Housing Standard Criteria',
    description:
      'Oil-filter housing construction, fluid interfaces, mounting and sealing criteria.',
    targetProductTypeCodes: ['OIL_FILTER_HOUSING'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_PORT_COUNT', 50),
      optionalComparable('ATTR_THREAD_SIZE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INLET_DIAMETER', 70),
      optionalComparable('ATTR_OUTLET_DIAMETER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
      optionalComparable('ATTR_GASKET_INCLUDED', 100),
    ],
  },
  {
    code: 'CANON_OIL_FILTER_HOUSING_CAP_V1',
    name: 'Oil Filter Housing Cap Standard Criteria',
    description:
      'Oil-filter housing cap dimensions, material, thread and sealing criteria.',
    targetProductTypeCodes: ['OIL_FILTER_HOUSING_CAP'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 30, { variantDefining: true }),
      requiredComparable('ATTR_THREAD_SIZE', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
      optionalComparable('ATTR_GASKET_INCLUDED', 60),
    ],
  },
  {
    code: 'CANON_AIR_FILTER_HOUSING_V1',
    name: 'Air Filter Housing Standard Criteria',
    description:
      'Air-filter housing dimensions, duct interfaces, material and mounting criteria.',
    targetProductTypeCodes: ['AIR_FILTER_HOUSING'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_INLET_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OUTLET_DIAMETER', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_FUEL_FILTER_HOUSING_V1',
    name: 'Fuel Filter Housing Standard Criteria',
    description:
      'Fuel-filter housing construction, fluid interfaces, integrated water handling and mounting criteria.',
    targetProductTypeCodes: ['FUEL_FILTER_HOUSING'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_PORT_COUNT', 50),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_INLET_DIAMETER', 70),
      optionalComparable('ATTR_OUTLET_DIAMETER', 80),
      optionalComparable('ATTR_WATER_SEPARATOR', 90),
      optionalComparable('ATTR_WATER_SENSOR_INCLUDED', 100),
      optionalComparable('ATTR_HEATER_INCLUDED', 110),
      optionalComparable('ATTR_MOUNTING_TYPE', 120),
      optionalComparable('ATTR_GASKET_INCLUDED', 130),
    ],
  },
  {
    code: 'CANON_FILTER_HOUSING_GASKET_V1',
    name: 'Filter Housing Gasket Standard Criteria',
    description:
      'Filter-housing gasket material, geometry and sealing-interface criteria.',
    targetProductTypeCodes: ['FILTER_HOUSING_GASKET'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      requiredComparable('ATTR_SEAL_TYPE', 20),
      optionalComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_THICKNESS', 50, { variantDefining: true }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
    ],
  },
  {
    code: 'CANON_PISTON_V1',
    name: 'Piston Standard Criteria',
    description:
      'Piston diameter, compression height, pin, crown, material, oversize and clearance criteria.',
    targetProductTypeCodes: ['PISTON'],
    items: [
      requiredComparable('ATTR_PISTON_DIAMETER', 10, { variantDefining: true }),
      requiredComparable('ATTR_PISTON_COMPRESSION_HEIGHT', 20, { variantDefining: true }),
      requiredComparable('ATTR_PISTON_PIN_DIAMETER', 30, { variantDefining: true }),
      optionalComparable('ATTR_PISTON_TOTAL_LENGTH', 40),
      optionalComparable('ATTR_PISTON_CROWN_TYPE', 50),
      optionalComparable('ATTR_PISTON_CROWN_VOLUME', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_PISTON_OVERSIZE', 80, { variantDefining: true }),
      optionalComparable('ATTR_PISTON_SKIRT_CLEARANCE', 90),
      optionalComparable('ATTR_PISTON_COOLING_GALLERY', 100),
      optionalComparable('ATTR_ITEM_WEIGHT', 110),
    ],
  },
  {
    code: 'CANON_PISTON_RING_SET_V1',
    name: 'Piston Ring Set Standard Criteria',
    description:
      'Piston-ring bore, ring stack dimensions, count, coating, material and end-gap criteria.',
    targetProductTypeCodes: ['PISTON_RING_SET'],
    items: [
      requiredComparable('ATTR_PISTON_RING_BORE', 10, { variantDefining: true }),
      requiredComparable('ATTR_TOP_RING_THICKNESS', 20, { variantDefining: true }),
      optionalComparable('ATTR_SECOND_RING_THICKNESS', 30, { variantDefining: true }),
      requiredComparable('ATTR_OIL_RING_THICKNESS', 40, { variantDefining: true }),
      requiredComparable('ATTR_PISTON_RING_COUNT', 50),
      optionalComparable('ATTR_RING_FACE_COATING', 60),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_RING_END_GAP', 80),
    ],
  },
  {
    code: 'CANON_CONNECTING_ROD_V1',
    name: 'Connecting Rod Standard Criteria',
    description:
      'Connecting-rod center length, end bores/widths, material and bushing criteria.',
    targetProductTypeCodes: ['CONNECTING_ROD'],
    items: [
      requiredComparable('ATTR_CONNECTING_ROD_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_CONNECTING_ROD_BIG_END_BORE', 20, { variantDefining: true }),
      requiredComparable('ATTR_CONNECTING_ROD_SMALL_END_BORE', 30, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTING_ROD_BIG_END_WIDTH', 40),
      optionalComparable('ATTR_CONNECTING_ROD_SMALL_END_WIDTH', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_CONNECTING_ROD_BUSHING_INCLUDED', 70),
      optionalComparable('ATTR_ITEM_WEIGHT', 80),
    ],
  },
  {
    code: 'CANON_CRANKSHAFT_V1',
    name: 'Crankshaft Standard Criteria',
    description:
      'Crankshaft overall geometry, journal diameters/counts, stroke, material and endplay criteria.',
    targetProductTypeCodes: ['CRANKSHAFT'],
    items: [
      requiredComparable('ATTR_CRANKSHAFT_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_CRANKSHAFT_MAIN_JOURNAL_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_CRANKSHAFT_ROD_JOURNAL_DIAMETER', 30, { variantDefining: true }),
      requiredComparable('ATTR_ENGINE_STROKE', 40, { variantDefining: true }),
      requiredComparable('ATTR_CRANKSHAFT_MAIN_JOURNAL_COUNT', 50),
      requiredComparable('ATTR_CRANKSHAFT_ROD_JOURNAL_COUNT', 60),
      optionalComparable('ATTR_CRANKSHAFT_ENDPLAY', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_ITEM_WEIGHT', 90),
    ],
  },
  {
    code: 'CANON_CRANKSHAFT_PULLEY_V1',
    name: 'Crankshaft Pulley Standard Criteria',
    description:
      'Crankshaft pulley diameter, width, rib count, damper construction and material criteria.',
    targetProductTypeCodes: ['CRANKSHAFT_PULLEY'],
    items: [
      requiredComparable('ATTR_PULLEY_DIAMETER', 10, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 30),
      requiredComparable('ATTR_CRANKSHAFT_PULLEY_DAMPER', 40),
      optionalComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_CENTER_BORE', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_ENGINE_BEARING_SET_V1',
    name: 'Engine Bearing Set Standard Criteria',
    description:
      'Main and connecting-rod shell bearing dimensions, size correction, clearance, material and oil-feed criteria.',
    targetProductTypeCodes: ['MAIN_BEARING_SET', 'CONNECTING_ROD_BEARING_SET'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_SHELL_WIDTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_BEARING_SHELL_THICKNESS', 30, { variantDefining: true }),
      optionalComparable('ATTR_BEARING_SIZE_OFFSET', 40, { variantDefining: true }),
      optionalComparable('ATTR_ENGINE_BEARING_CLEARANCE', 50),
      requiredComparable('ATTR_BEARING_SHELL_COUNT', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_BEARING_OIL_GROOVE', 80),
      optionalComparable('ATTR_BEARING_OIL_HOLE', 90),
    ],
  },
  {
    code: 'CANON_THRUST_WASHER_SET_V1',
    name: 'Crankshaft Thrust Washer Set Standard Criteria',
    description:
      'Crankshaft thrust-washer thickness, inner/outer diameter, material and set-count criteria.',
    targetProductTypeCodes: ['THRUST_WASHER_SET'],
    items: [
      requiredComparable('ATTR_THRUST_WASHER_THICKNESS', 10, { variantDefining: true }),
      optionalComparable('ATTR_THRUST_WASHER_INSIDE_DIAMETER', 20, { variantDefining: true }),
      optionalComparable('ATTR_THRUST_WASHER_OUTSIDE_DIAMETER', 30, { variantDefining: true }),
      requiredComparable('ATTR_THRUST_WASHER_COUNT', 40),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_COATING', 60),
    ],
  },
  {
    code: 'CANON_CYLINDER_HEAD_V1',
    name: 'Cylinder Head Standard Criteria',
    description:
      'Cylinder-head material, height, chamber volume, ports, valve/cam count and assembly-state criteria.',
    targetProductTypeCodes: ['CYLINDER_HEAD'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_CYLINDER_HEAD_HEIGHT', 20, { variantDefining: true }),
      optionalComparable('ATTR_COMBUSTION_CHAMBER_VOLUME', 30, { variantDefining: true }),
      requiredComparable('ATTR_CYLINDER_COUNT', 40),
      requiredComparable('ATTR_VALVE_COUNT', 50),
      requiredComparable('ATTR_INTAKE_PORT_COUNT', 60),
      requiredComparable('ATTR_EXHAUST_PORT_COUNT', 70),
      optionalComparable('ATTR_CAMSHAFT_COUNT', 80),
      requiredComparable('ATTR_CYLINDER_HEAD_ASSEMBLED', 90),
    ],
  },
  {
    code: 'CANON_CAMSHAFT_V1',
    name: 'Camshaft Standard Criteria',
    description:
      'Camshaft length, journals, lobe count, lift, duration, material and VVT criteria.',
    targetProductTypeCodes: ['CAMSHAFT'],
    items: [
      requiredComparable('ATTR_CAMSHAFT_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_CAMSHAFT_JOURNAL_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_CAM_LOBE_COUNT', 30),
      optionalComparable('ATTR_CAM_LIFT', 40, { variantDefining: true }),
      optionalComparable('ATTR_CAM_DURATION', 50, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_VVT_COMPATIBLE', 70),
    ],
  },
  {
    code: 'CANON_ENGINE_VALVE_V1',
    name: 'Engine Valve Standard Criteria',
    description:
      'Intake/exhaust valve head, stem, length, material and keeper-groove criteria.',
    targetProductTypeCodes: ['ENGINE_VALVE'],
    items: [
      requiredComparable('ATTR_ENGINE_VALVE_TYPE', 10),
      requiredComparable('ATTR_VALVE_HEAD_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_STEM_DIAMETER', 30, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_TOTAL_LENGTH', 40, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_COATING', 60),
      optionalComparable('ATTR_VALVE_KEEPER_GROOVE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_VALVE_GUIDE_V1',
    name: 'Valve Guide Standard Criteria',
    description:
      'Valve-guide bore, outside diameter, length and material criteria.',
    targetProductTypeCodes: ['VALVE_GUIDE'],
    items: [
      requiredComparable('ATTR_VALVE_GUIDE_INSIDE_DIAMETER', 10, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_GUIDE_OUTSIDE_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_GUIDE_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_VALVE_LIFTER_V1',
    name: 'Valve Lifter / Tappet Standard Criteria',
    description:
      'Lifter construction, diameter, height, hydraulic/roller configuration and material criteria.',
    targetProductTypeCodes: ['VALVE_LIFTER'],
    items: [
      requiredComparable('ATTR_VALVE_LIFTER_TYPE', 10),
      requiredComparable('ATTR_VALVE_LIFTER_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_LIFTER_HEIGHT', 30, { variantDefining: true }),
      optionalComparable('ATTR_VALVE_LIFTER_HYDRAULIC', 40),
      optionalComparable('ATTR_VALVE_LIFTER_ROLLER', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_ROCKER_ARM_V1',
    name: 'Rocker Arm Standard Criteria',
    description:
      'Rocker/finger follower construction, ratio, length, material and bearing criteria.',
    targetProductTypeCodes: ['ROCKER_ARM'],
    items: [
      requiredComparable('ATTR_ROCKER_ARM_TYPE', 10),
      optionalComparable('ATTR_ROCKER_ARM_RATIO', 20, { variantDefining: true }),
      optionalComparable('ATTR_ROCKER_ARM_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_ROCKER_BEARING_INCLUDED', 50),
    ],
  },
  {
    code: 'CANON_VALVE_SPRING_V1',
    name: 'Valve Spring Standard Criteria',
    description:
      'Valve-spring free geometry, wire size, coil count, rate and material criteria.',
    targetProductTypeCodes: ['VALVE_SPRING'],
    items: [
      requiredComparable('ATTR_VALVE_SPRING_FREE_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_SPRING_OUTSIDE_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_VALVE_SPRING_WIRE_DIAMETER', 30, { variantDefining: true }),
      optionalComparable('ATTR_VALVE_SPRING_COIL_COUNT', 40),
      optionalComparable('ATTR_VALVE_SPRING_RATE', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_CAMSHAFT_ADJUSTER_V1',
    name: 'Camshaft Adjuster Standard Criteria',
    description:
      'Variable camshaft adjuster construction, phasing range, sprocket teeth and mounting criteria.',
    targetProductTypeCodes: ['CAMSHAFT_ADJUSTER'],
    items: [
      requiredComparable('ATTR_CAM_ADJUSTER_TYPE', 10),
      optionalComparable('ATTR_CAM_ADJUSTER_RANGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CAM_ADJUSTER_TOOTH_COUNT', 30, { variantDefining: true }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 40),
      optionalComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_OIL_PUMP_V1',
    name: 'Engine Oil Pump Standard Criteria',
    description:
      'Engine-oil pump construction, drive, flow, pressure, relief-valve and mounting criteria.',
    targetProductTypeCodes: ['OIL_PUMP'],
    items: [
      requiredComparable('ATTR_OIL_PUMP_TYPE', 10),
      requiredComparable('ATTR_OIL_PUMP_DRIVE_TYPE', 20),
      optionalComparable('ATTR_OIL_PUMP_FLOW_RATE', 30, { variantDefining: true }),
      optionalComparable('ATTR_OIL_PUMP_PRESSURE', 40, { variantDefining: true }),
      optionalComparable('ATTR_OIL_PUMP_RELIEF_VALVE', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
    ],
  },
  {
    code: 'CANON_OIL_PAN_V1',
    name: 'Oil Pan / Sump Standard Criteria',
    description:
      'Oil-pan material, capacity, geometry, drain thread, sensor ports and sealing criteria.',
    targetProductTypeCodes: ['OIL_PAN'],
    items: [
      requiredComparable('ATTR_OIL_PAN_MATERIAL', 10),
      optionalComparable('ATTR_OIL_PAN_CAPACITY', 20),
      optionalComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 50, { variantDefining: true }),
      requiredComparable('ATTR_OIL_PAN_DRAIN_THREAD', 60),
      optionalComparable('ATTR_OIL_PAN_SENSOR_PORT_COUNT', 70),
      optionalComparable('ATTR_GASKET_INCLUDED', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_OIL_PICKUP_TUBE_V1',
    name: 'Oil Pickup Tube Standard Criteria',
    description:
      'Oil-pickup tube length, diameter, material, strainer and mounting criteria.',
    targetProductTypeCodes: ['OIL_PICKUP_TUBE'],
    items: [
      requiredComparable('ATTR_OIL_PICKUP_LENGTH', 10, { variantDefining: true }),
      optionalComparable('ATTR_OIL_PICKUP_TUBE_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_OIL_PICKUP_STRAINER_INCLUDED', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
      optionalComparable('ATTR_GASKET_INCLUDED', 60),
    ],
  },
  {
    code: 'CANON_OIL_COOLER_V1',
    name: 'Engine Oil Cooler Standard Criteria',
    description:
      'Engine-oil cooler architecture, core geometry, fluid interfaces, material and pressure criteria.',
    targetProductTypeCodes: ['OIL_COOLER'],
    items: [
      requiredComparable('ATTR_OIL_COOLER_TYPE', 10),
      optionalComparable('ATTR_OIL_COOLER_CORE_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_OIL_COOLER_CORE_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_OIL_COOLER_CORE_THICKNESS', 40, { variantDefining: true }),
      optionalComparable('ATTR_INLET_DIAMETER', 50),
      optionalComparable('ATTR_OUTLET_DIAMETER', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
      optionalComparable('ATTR_PORT_COUNT', 90),
    ],
  },
  {
    code: 'CANON_OIL_PRESSURE_SWITCH_V1',
    name: 'Oil Pressure Switch Standard Criteria',
    description:
      'Oil-pressure switch threshold, thread, electrical connection and mounting criteria.',
    targetProductTypeCodes: ['OIL_PRESSURE_SWITCH'],
    items: [
      requiredComparable('ATTR_OIL_PRESSURE_SWITCH_POINT', 10, { variantDefining: true }),
      requiredComparable('ATTR_THREAD_SIZE', 20, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_SWITCH_TYPE', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
    ],
  },
  {
    code: 'CANON_OIL_PRESSURE_SENSOR_V1',
    name: 'Oil Pressure Sensor Standard Criteria',
    description:
      'Oil-pressure sensor range, thread, signal/output and connector criteria.',
    targetProductTypeCodes: ['OIL_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_OIL_PRESSURE_SENSOR_MAX', 10, { variantDefining: true }),
      requiredComparable('ATTR_THREAD_SIZE', 20, { variantDefining: true }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_SENSOR_TYPE', 40),
      optionalComparable('ATTR_SIGNAL_TYPE', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 70),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 80),
      requiredComparable('ATTR_PIN_COUNT', 90, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
    ],
  },
  {
    code: 'CANON_OIL_FILLER_CAP_V1',
    name: 'Oil Filler Cap Standard Criteria',
    description:
      'Oil-filler cap attachment, thread, sealing, material and geometry criteria.',
    targetProductTypeCodes: ['OIL_FILLER_CAP'],
    items: [
      requiredComparable('ATTR_OIL_FILLER_CAP_TYPE', 10),
      optionalComparable('ATTR_THREAD_SIZE', 20, { variantDefining: true }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40),
      optionalComparable('ATTR_SEAL_TYPE', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_DRAIN_PLUG_V1',
    name: 'Oil Drain Plug Standard Criteria',
    description:
      'Oil drain-plug fastener diameter, thread, pitch, length, head, material and torque criteria.',
    targetProductTypeCodes: ['DRAIN_PLUG'],
    items: [
      requiredComparable('ATTR_FASTENER_TYPE', 10),
      requiredComparable('ATTR_FASTENER_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_FASTENER_THREAD', 30, { variantDefining: true }),
      optionalComparable('ATTR_FASTENER_THREAD_PITCH', 40),
      optionalComparable('ATTR_FASTENER_LENGTH', 50),
      optionalComparable('ATTR_FASTENER_HEAD_TYPE', 60),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 80),
    ],
  },
  {
    code: 'CANON_DRAIN_PLUG_WASHER_V1',
    name: 'Oil Drain Plug Washer Standard Criteria',
    description:
      'Drain-plug sealing washer inside/outside diameter, thickness and material criteria.',
    targetProductTypeCodes: ['DRAIN_PLUG_WASHER'],
    items: [
      requiredComparable('ATTR_DRAIN_PLUG_WASHER_INSIDE_DIAMETER', 10, { variantDefining: true }),
      requiredComparable('ATTR_DRAIN_PLUG_WASHER_OUTSIDE_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_DRAIN_PLUG_WASHER_THICKNESS', 30, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_ENGINE_MOUNT_V1',
    name: 'Engine / Transmission Mount Standard Criteria',
    description:
      'Engine, transmission and torque mount construction, geometry, hydraulic/active behavior and installation criteria.',
    targetProductTypeCodes: ['ENGINE_MOUNT', 'TRANSMISSION_MOUNT', 'TORQUE_MOUNT'],
    items: [
      requiredComparable('ATTR_ENGINE_MOUNT_TYPE', 10),
      optionalComparable('ATTR_HYDRAULIC_MOUNT', 20),
      optionalComparable('ATTR_ACTIVE_MOUNT', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 60, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_STUD_COUNT', 90),
      optionalComparable('ATTR_BOLT_COUNT', 100),
    ],
  },
  {
    code: 'CANON_ENGINE_MOUNT_BRACKET_V1',
    name: 'Engine Mount Bracket Standard Criteria',
    description:
      'Engine-mount bracket material, geometry and mounting-hole criteria.',
    targetProductTypeCodes: ['ENGINE_MOUNT_BRACKET'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      requiredComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
      optionalComparable('ATTR_STUD_COUNT', 60),
    ],
  },
  {
    code: 'CANON_PCV_VALVE_V1',
    name: 'PCV Valve Standard Criteria',
    description:
      'PCV valve construction, opening pressure, ports, interfaces and mounting criteria.',
    targetProductTypeCodes: ['PCV_VALVE'],
    items: [
      requiredComparable('ATTR_PCV_VALVE_TYPE', 10),
      optionalComparable('ATTR_PCV_OPENING_PRESSURE', 20),
      optionalComparable('ATTR_PORT_COUNT', 30),
      optionalComparable('ATTR_INLET_DIAMETER', 40),
      optionalComparable('ATTR_OUTLET_DIAMETER', 50),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_CRANKCASE_BREATHER_HOSE_V1',
    name: 'Crankcase Breather Hose Standard Criteria',
    description:
      'Crankcase breather hose length, bore, branches, material and connection criteria.',
    targetProductTypeCodes: ['CRANKCASE_BREATHER_HOSE'],
    items: [
      requiredComparable('ATTR_BREATHER_HOSE_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_BREATHER_HOSE_INNER_DIAMETER', 20, { variantDefining: true }),
      optionalComparable('ATTR_BREATHER_HOSE_BRANCH_COUNT', 30),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_CONNECTION_1', 50),
      optionalComparable('ATTR_CONNECTION_2', 60),
    ],
  },
  {
    code: 'CANON_OIL_SEPARATOR_V1',
    name: 'Oil Separator Standard Criteria',
    description:
      'Crankcase oil-separator construction, ports, interfaces, material and mounting criteria.',
    targetProductTypeCodes: ['OIL_SEPARATOR'],
    items: [
      requiredComparable('ATTR_OIL_SEPARATOR_TYPE', 10),
      optionalComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_INLET_DIAMETER', 30),
      optionalComparable('ATTR_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_CRANKCASE_BREATHER_ASSEMBLY_V1',
    name: 'Crankcase Breather Assembly Standard Criteria',
    description:
      'Crankcase breather assembly ports, integrated PCV/oil-separator functions, material and package criteria.',
    targetProductTypeCodes: ['CRANKCASE_BREATHER_ASSEMBLY'],
    items: [
      optionalComparable('ATTR_PORT_COUNT', 10),
      optionalComparable('ATTR_PCV_VALVE_INCLUDED', 20),
      optionalComparable('ATTR_OIL_SEPARATOR_INCLUDED', 30),
      optionalComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
    ],
  },
  {
    code: 'CANON_ENGINE_FASTENER_SET_V1',
    name: 'Engine Critical Fastener Set Standard Criteria',
    description:
      'Cylinder-head and flywheel bolt-set diameter, thread, length, grade, head and package criteria.',
    targetProductTypeCodes: ['CYLINDER_HEAD_BOLT_SET', 'FLYWHEEL_BOLT_SET'],
    items: [
      requiredComparable('ATTR_FASTENER_TYPE', 10),
      requiredComparable('ATTR_FASTENER_DIAMETER', 20, { variantDefining: true }),
      requiredComparable('ATTR_FASTENER_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_FASTENER_THREAD', 40, { variantDefining: true }),
      optionalComparable('ATTR_FASTENER_THREAD_PITCH', 50),
      optionalComparable('ATTR_FASTENER_GRADE', 60),
      optionalComparable('ATTR_FASTENER_HEAD_TYPE', 70),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 90),
    ],
  },
  {
    code: 'CANON_CORE_PLUG_V1',
    name: 'Engine Core Plug Standard Criteria',
    description:
      'Engine core/freeze plug diameter, depth, material and finish criteria.',
    targetProductTypeCodes: ['CORE_PLUG'],
    items: [
      requiredComparable('ATTR_CORE_PLUG_DIAMETER', 10, { variantDefining: true }),
      optionalComparable('ATTR_CORE_PLUG_DEPTH', 20, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_COATING', 40),
    ],
  },
  {
    code: 'CANON_ENGINE_BLOCK_V1',
    name: 'Engine Block Standard Criteria',
    description:
      'Engine-block cylinder geometry, deck/bore spacing, main-bearing count, material and displacement criteria.',
    targetProductTypeCodes: ['ENGINE_BLOCK'],
    items: [
      requiredComparable('ATTR_CYLINDER_COUNT', 10),
      requiredComparable('ATTR_ENGINE_BORE', 20, { variantDefining: true }),
      requiredComparable('ATTR_ENGINE_STROKE', 30, { variantDefining: true }),
      optionalComparable('ATTR_ENGINE_DISPLACEMENT', 40),
      optionalComparable('ATTR_ENGINE_BLOCK_DECK_HEIGHT', 50, { variantDefining: true }),
      optionalComparable('ATTR_ENGINE_BLOCK_BORE_SPACING', 60, { variantDefining: true }),
      requiredComparable('ATTR_ENGINE_BLOCK_MAIN_BEARING_COUNT', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_ITEM_WEIGHT', 90),
    ],
  },
  {
    code: 'CANON_SPARK_PLUG_V1',
    name: 'Spark Plug Standard Criteria',
    description:
      'Spark-plug thread, reach, hex, gap, heat-range, projection, terminal and electrode criteria. Exact engine compatibility remains structured fitment.',
    targetProductTypeCodes: ['SPARK_PLUG'],
    items: [
      requiredComparable('ATTR_SPARK_PLUG_THREAD', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPARK_PLUG_REACH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPARK_PLUG_HEX_SIZE', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPARK_PLUG_GAP', 40),
      requiredComparable('ATTR_SPARK_PLUG_HEAT_RANGE', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPARK_PLUG_PROJECTION', 60),
      requiredComparable('ATTR_ELECTRODE_MATERIAL', 70),
      optionalComparable('ATTR_RESISTANCE', 80),
      optionalComparable('ATTR_SPARK_PLUG_TERMINAL_SHAPE', 90),
    ],
  },
  {
    code: 'CANON_IGNITION_COIL_V1',
    name: 'Ignition Coil Standard Criteria',
    description:
      'Ignition-coil construction, primary/secondary electrical characteristics, high-voltage output and connector criteria.',
    targetProductTypeCodes: ['IGNITION_COIL'],
    items: [
      requiredComparable('ATTR_IGNITION_COIL_TYPE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 20),
      optionalComparable('ATTR_IGNITION_OUTPUT_VOLTAGE', 30),
      optionalComparable('ATTR_IGNITION_PRIMARY_RESISTANCE', 40),
      optionalComparable('ATTR_IGNITION_SECONDARY_RESISTANCE', 50),
      optionalComparable('ATTR_IGNITION_TOWER_COUNT', 60),
      requiredComparable('ATTR_CONNECTOR_GENDER', 70),
      requiredComparable('ATTR_PIN_COUNT', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_IGNITION_WIRE_SET_V1',
    name: 'Ignition Wire Set Standard Criteria',
    description:
      'Ignition-lead set count, conductor/suppression, terminal and length criteria.',
    targetProductTypeCodes: ['IGNITION_WIRE_SET'],
    items: [
      requiredComparable('ATTR_IGNITION_LEAD_COUNT', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_IGNITION_LEAD_LENGTH', 20),
      optionalComparable('ATTR_IGNITION_LEAD_SUPPRESSION', 30),
      optionalComparable('ATTR_WIRE_GAUGE', 40),
      optionalComparable('ATTR_CONDUCTOR_MATERIAL', 50),
      optionalComparable('ATTR_INSULATION_MATERIAL', 60),
      optionalComparable('ATTR_RESISTANCE', 70),
      optionalComparable('ATTR_TERMINAL_TYPE', 80),
    ],
  },
  {
    code: 'CANON_DISTRIBUTOR_CAP_V1',
    name: 'Distributor Cap Standard Criteria',
    description:
      'Ignition distributor-cap terminal count, high-voltage capability, material and mounting criteria.',
    targetProductTypeCodes: ['DISTRIBUTOR_CAP'],
    items: [
      requiredComparable('ATTR_DISTRIBUTOR_CAP_TERMINAL_COUNT', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_IGNITION_OUTPUT_VOLTAGE', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_MOUNTING_TYPE', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
      optionalComparable('ATTR_TERMINAL_TYPE', 60),
    ],
  },
  {
    code: 'CANON_DISTRIBUTOR_ROTOR_V1',
    name: 'Distributor Rotor Standard Criteria',
    description:
      'Ignition distributor-rotor material, resistance, high-voltage and speed-limiter criteria.',
    targetProductTypeCodes: ['DISTRIBUTOR_ROTOR'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_RESISTANCE', 20),
      optionalComparable('ATTR_IGNITION_OUTPUT_VOLTAGE', 30),
      optionalComparable('ATTR_ROTOR_SPEED_LIMITER', 40),
      optionalComparable('ATTR_MAX_ROTATIONAL_SPEED', 50),
    ],
  },
  {
    code: 'CANON_IGNITION_MODULE_V1',
    name: 'Ignition Module Standard Criteria',
    description:
      'Ignition power-stage/module construction, voltage, connector, circuit and mounting criteria.',
    targetProductTypeCodes: ['IGNITION_MODULE'],
    items: [
      requiredComparable('ATTR_IGNITION_MODULE_TYPE', 10),
      optionalComparable('ATTR_VOLTAGE', 20),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_CIRCUIT_COUNT', 40),
      requiredComparable('ATTR_CONNECTOR_COUNT', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_IGNITION_CONDENSER_V1',
    name: 'Ignition Condenser Standard Criteria',
    description:
      'Ignition condenser capacitance, voltage, lead and mounting criteria.',
    targetProductTypeCodes: ['IGNITION_CONDENSER'],
    items: [
      requiredComparable('ATTR_CAPACITANCE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 20),
      optionalComparable('ATTR_CABLE_LENGTH', 30),
      optionalComparable('ATTR_TERMINAL_TYPE', 40),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
    ],
  },
  {
    code: 'CANON_GLOW_PLUG_V1',
    name: 'Glow Plug Standard Criteria',
    description:
      'Glow-plug technology, electrical rating, body/terminal thread, installation geometry and heating performance criteria.',
    targetProductTypeCodes: ['GLOW_PLUG'],
    items: [
      requiredComparable('ATTR_GLOW_PLUG_TYPE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      requiredComparable('ATTR_THREAD_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 40),
      requiredComparable('ATTR_GLOW_PLUG_OVERALL_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GLOW_PLUG_INSTALLATION_DEPTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GLOW_PLUG_TIP_DIAMETER', 70),
      optionalComparable('ATTR_GLOW_PLUG_HEATING_TIME', 80),
      optionalComparable('ATTR_GLOW_PLUG_HEATING_TEMPERATURE', 90),
      optionalComparable('ATTR_GLOW_PLUG_TERMINAL_THREAD', 100),
      optionalComparable('ATTR_RESISTANCE', 110),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 120),
    ],
  },
  {
    code: 'CANON_GLOW_PLUG_RELAY_V1',
    name: 'Glow Plug Relay Standard Criteria',
    description:
      'Glow-plug relay coil voltage, switching current, contact, suppression and connector criteria.',
    targetProductTypeCodes: ['GLOW_PLUG_RELAY'],
    items: [
      requiredComparable('ATTR_RELAY_COIL_VOLTAGE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RELAY_SWITCHING_CURRENT', 20),
      optionalComparable('ATTR_RELAY_CONTACT_FORM', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RELAY_RESISTOR_INCLUDED', 50),
      optionalComparable('ATTR_RELAY_DIODE_INCLUDED', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_GLOW_PLUG_CONTROL_MODULE_V1',
    name: 'Glow Plug Control Module Standard Criteria',
    description:
      'Glow-plug controller electrical, circuit, connector, communication and programming criteria.',
    targetProductTypeCodes: ['GLOW_PLUG_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      requiredComparable('ATTR_CONNECTOR_COUNT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 60),
      optionalComparable('ATTR_PROGRAMMABLE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_GLOW_PLUG_WIRING_HARNESS_V1',
    name: 'Glow Plug Wiring Harness Standard Criteria',
    description:
      'Glow-plug harness branch, connector, conductor, insulation and environmental-sealing criteria.',
    targetProductTypeCodes: ['GLOW_PLUG_WIRING_HARNESS'],
    items: [
      requiredComparable('ATTR_HARNESS_BRANCH_COUNT', 10),
      requiredComparable('ATTR_CONNECTOR_COUNT', 20),
      optionalComparable('ATTR_PIN_COUNT', 30),
      optionalComparable('ATTR_CABLE_LENGTH', 40),
      optionalComparable('ATTR_WIRE_GAUGE', 50),
      optionalComparable('ATTR_CONDUCTOR_MATERIAL', 60),
      optionalComparable('ATTR_INSULATION_MATERIAL', 70),
      optionalComparable('ATTR_SEALED_CONNECTOR', 80),
    ],
  },
  {
    code: 'CANON_FUEL_PUMP_V1',
    name: 'Fuel Pump Standard Criteria',
    description:
      'Low-pressure fuel-pump construction, electrical rating, delivery flow, pressure and fluid-interface criteria.',
    targetProductTypeCodes: ['FUEL_PUMP'],
    items: [
      requiredComparable('ATTR_FUEL_PUMP_TYPE', 10),
      optionalComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      requiredComparable('ATTR_FUEL_FLOW_RATE', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FUEL_SYSTEM_PRESSURE', 50),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_PIN_COUNT', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_IN_TANK_FUEL_PUMP_V1',
    name: 'In-Tank Fuel Pump Standard Criteria',
    description:
      'In-tank fuel-pump/module delivery, electrical, integrated sender/regulator and interface criteria.',
    targetProductTypeCodes: ['IN_TANK_FUEL_PUMP'],
    items: [
      requiredComparable('ATTR_FUEL_PUMP_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      requiredComparable('ATTR_FUEL_FLOW_RATE', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_SYSTEM_PRESSURE', 50),
      optionalComparable('ATTR_FUEL_LEVEL_SENDER_INCLUDED', 60),
      optionalComparable('ATTR_FUEL_PRESSURE_REGULATOR_INCLUDED', 70),
      optionalComparable('ATTR_OUTLET_DIAMETER', 80),
      optionalComparable('ATTR_CONNECTOR_COUNT', 90),
      optionalComparable('ATTR_PIN_COUNT', 100),
    ],
  },
  {
    code: 'CANON_HIGH_PRESSURE_FUEL_PUMP_V1',
    name: 'High Pressure Fuel Pump Standard Criteria',
    description:
      'High-pressure injection pump drive, flow, pressure, port and mounting criteria.',
    targetProductTypeCodes: ['HIGH_PRESSURE_FUEL_PUMP'],
    items: [
      requiredComparable('ATTR_FUEL_PUMP_TYPE', 10),
      requiredComparable('ATTR_FUEL_PUMP_DRIVE_TYPE', 20),
      requiredComparable('ATTR_FUEL_PRESSURE_MAX', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_FLOW_RATE', 40),
      optionalComparable('ATTR_PORT_COUNT', 50),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_THREAD_SIZE', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
    ],
  },
  {
    code: 'CANON_FUEL_PRESSURE_REGULATOR_V1',
    name: 'Fuel Pressure Regulator Standard Criteria',
    description:
      'Fuel-pressure regulator architecture, calibrated pressure range and fluid-interface criteria.',
    targetProductTypeCodes: ['FUEL_PRESSURE_REGULATOR'],
    items: [
      requiredComparable('ATTR_FUEL_PRESSURE_REGULATOR_TYPE', 10),
      optionalComparable('ATTR_FUEL_PRESSURE_MIN', 20),
      requiredComparable('ATTR_FUEL_PRESSURE_MAX', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PORT_COUNT', 40),
      optionalComparable('ATTR_THREAD_SIZE', 50),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_CONNECTION_1', 80),
      optionalComparable('ATTR_CONNECTION_2', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_FUEL_TANK_V1',
    name: 'Fuel Tank Standard Criteria',
    description:
      'Fuel-tank capacity, construction material, geometry and filler-neck criteria.',
    targetProductTypeCodes: ['FUEL_TANK'],
    items: [
      requiredComparable('ATTR_FUEL_TANK_CAPACITY', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FUEL_TANK_MATERIAL', 20),
      optionalComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 50, { variantDefining: true }),
      optionalComparable('ATTR_FUEL_FILLER_NECK_DIAMETER', 60),
      optionalComparable('ATTR_FUEL_LEVEL_SENDER_INCLUDED', 70),
      optionalComparable('ATTR_PORT_COUNT', 80),
    ],
  },
  {
    code: 'CANON_FUEL_TANK_CAP_V1',
    name: 'Fuel Tank Cap Standard Criteria',
    description:
      'Fuel-cap attachment, filler-neck interface, locking, venting, seal and material criteria.',
    targetProductTypeCodes: ['FUEL_TANK_CAP'],
    items: [
      requiredComparable('ATTR_FUEL_CAP_TYPE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_FILLER_NECK_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_CAP_LOCKABLE', 30),
      optionalComparable('ATTR_FUEL_CAP_VENTED', 40),
      optionalComparable('ATTR_SEAL_TYPE', 50),
      optionalComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
    ],
  },
  {
    code: 'CANON_FUEL_LEVEL_SENSOR_V1',
    name: 'Fuel Level Sensor Standard Criteria',
    description:
      'Fuel-level sender resistance endpoints, float-arm, signal and connector criteria.',
    targetProductTypeCodes: ['FUEL_LEVEL_SENSOR'],
    items: [
      optionalComparable('ATTR_FUEL_LEVEL_RESISTANCE_EMPTY', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_LEVEL_RESISTANCE_FULL', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLOAT_ARM_LENGTH', 30),
      optionalComparable('ATTR_SIGNAL_TYPE', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      requiredComparable('ATTR_CONNECTOR_GENDER', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_FUEL_PUMP_CONTROL_MODULE_V1',
    name: 'Fuel Pump Control Module Standard Criteria',
    description:
      'Fuel-pump controller voltage/current, connector, communication, programming and mounting criteria.',
    targetProductTypeCodes: ['FUEL_PUMP_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      requiredComparable('ATTR_CONNECTOR_COUNT', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 50),
      optionalComparable('ATTR_PROGRAMMABLE', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_FUEL_INJECTOR_V1',
    name: 'Fuel Injector Standard Criteria',
    description:
      'Fuel injector construction, feed, flow, pressure, spray, installation, resistance and connector criteria.',
    targetProductTypeCodes: ['FUEL_INJECTOR'],
    items: [
      requiredComparable('ATTR_INJECTOR_TYPE', 10),
      optionalComparable('ATTR_INJECTOR_FEED_TYPE', 20),
      requiredComparable('ATTR_INJECTOR_FLOW_RATE', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_INJECTOR_SYSTEM_PRESSURE', 40),
      requiredComparable('ATTR_INJECTOR_SPRAY_TYPE', 50),
      optionalComparable('ATTR_INJECTOR_SPRAY_ANGLE', 60),
      optionalComparable('ATTR_INJECTOR_BENT_ANGLE', 70),
      optionalComparable('ATTR_INJECTOR_HOLE_COUNT', 80),
      requiredComparable('ATTR_INJECTOR_INSTALLATION_LENGTH', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INJECTOR_SEAL_DIAMETER', 100),
      optionalComparable('ATTR_RESISTANCE', 110),
      optionalComparable('ATTR_VOLTAGE', 120),
      requiredComparable('ATTR_CONNECTOR_GENDER', 130),
      optionalComparable('ATTR_PIN_COUNT', 140),
    ],
  },
  {
    code: 'CANON_INJECTOR_NOZZLE_V1',
    name: 'Injector Nozzle Standard Criteria',
    description:
      'Injector nozzle construction, hole/orifice geometry, spray and pressure criteria.',
    targetProductTypeCodes: ['INJECTOR_NOZZLE'],
    items: [
      requiredComparable('ATTR_INJECTOR_NOZZLE_TYPE', 10),
      requiredComparable('ATTR_INJECTOR_HOLE_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_NOZZLE_ORIFICE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INJECTOR_SPRAY_ANGLE', 40),
      optionalComparable('ATTR_INJECTOR_SPRAY_TYPE', 50),
      requiredComparable('ATTR_INJECTOR_SYSTEM_PRESSURE', 60),
      optionalComparable('ATTR_INJECTOR_SEAL_DIAMETER', 70),
    ],
  },
  {
    code: 'CANON_INJECTOR_SEAL_KIT_V1',
    name: 'Injector Seal Kit Standard Criteria',
    description:
      'Injector sealing-kit seal type, material, diameter and package-content criteria.',
    targetProductTypeCodes: ['INJECTOR_SEAL_KIT'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_MATERIAL', 20),
      optionalComparable('ATTR_INJECTOR_SEAL_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 40),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 50),
      optionalComparable('ATTR_THICKNESS', 60),
    ],
  },
  {
    code: 'CANON_FUEL_RAIL_V1',
    name: 'Fuel Rail Standard Criteria',
    description:
      'Fuel-rail geometry, construction, port count, pressure and sensor/regulator interface criteria.',
    targetProductTypeCodes: ['FUEL_RAIL'],
    items: [
      requiredComparable('ATTR_FUEL_RAIL_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 20),
      requiredComparable('ATTR_FUEL_RAIL_PORT_COUNT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FUEL_PRESSURE_MAX', 40),
      optionalComparable('ATTR_FUEL_RAIL_SENSOR_PORT', 50),
      optionalComparable('ATTR_FUEL_RAIL_REGULATOR_PORT', 60),
      optionalComparable('ATTR_INLET_DIAMETER', 70),
      optionalComparable('ATTR_OUTLET_DIAMETER', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_FUEL_RAIL_PRESSURE_SENSOR_V1',
    name: 'Fuel Rail Pressure Sensor Standard Criteria',
    description:
      'Fuel-pressure sensor range, electrical supply/output, response, thread, sealing and connector criteria.',
    targetProductTypeCodes: ['FUEL_RAIL_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_FUEL_PRESSURE_MIN', 20),
      requiredComparable('ATTR_FUEL_PRESSURE_MAX', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 70),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 80),
      requiredComparable('ATTR_THREAD_SIZE', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 100),
      requiredComparable('ATTR_PIN_COUNT', 110, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 120),
      optionalComparable('ATTR_SEAL_TYPE', 130),
    ],
  },
  {
    code: 'CANON_INJECTOR_RETURN_LINE_V1',
    name: 'Injector Return Line Standard Criteria',
    description:
      'Injector leak-off/return line length, bore, material, connections and package criteria.',
    targetProductTypeCodes: ['INJECTOR_RETURN_LINE'],
    items: [
      requiredComparable('ATTR_FUEL_LINE_LENGTH', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_LINE_INNER_DIAMETER', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_CONNECTION_1', 40),
      optionalComparable('ATTR_CONNECTION_2', 50),
      optionalComparable('ATTR_PORT_COUNT', 60),
    ],
  },
  {
    code: 'CANON_THROTTLE_BODY_V1',
    name: 'Throttle Body Standard Criteria',
    description:
      'Throttle-body construction, bore geometry, plate count, integrated sensing/control and electrical interface criteria.',
    targetProductTypeCodes: ['THROTTLE_BODY'],
    items: [
      requiredComparable('ATTR_THROTTLE_BODY_TYPE', 10),
      requiredComparable('ATTR_THROTTLE_BORE_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THROTTLE_PLATE_COUNT', 30),
      optionalComparable('ATTR_THROTTLE_POSITION_SENSOR_INCLUDED', 40),
      optionalComparable('ATTR_IDLE_CONTROL_INCLUDED', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_CONNECTOR_COUNT', 70),
      optionalComparable('ATTR_PIN_COUNT', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_INTAKE_MANIFOLD_V1',
    name: 'Intake Manifold Standard Criteria',
    description:
      'Intake-manifold material, runner count/geometry, throttle interface, sensor ports and mounting criteria.',
    targetProductTypeCodes: ['INTAKE_MANIFOLD'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      requiredComparable('ATTR_INTAKE_RUNNER_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INTAKE_PORT_DIAMETER', 30),
      optionalComparable('ATTR_THROTTLE_FLANGE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INTAKE_SENSOR_PORT_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_GASKET_INCLUDED', 70),
    ],
  },
  {
    code: 'CANON_AIR_INTAKE_HOSE_V1',
    name: 'Air Intake Hose Standard Criteria',
    description:
      'Engine air-intake hose length, end diameters, material, branches and connection criteria.',
    targetProductTypeCodes: ['AIR_INTAKE_HOSE'],
    items: [
      requiredComparable('ATTR_LENGTH', 10, { variantDefining: true }),
      requiredComparable('ATTR_INLET_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_OUTLET_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_PORT_COUNT', 50),
      optionalComparable('ATTR_CONNECTION_1', 60),
      optionalComparable('ATTR_CONNECTION_2', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_MASS_AIR_FLOW_SENSOR_V1',
    name: 'Mass Air Flow Sensor Standard Criteria',
    description:
      'Air-flow sensor technology, range, supply/output, response and connector criteria.',
    targetProductTypeCodes: ['MASS_AIR_FLOW_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_AIR_FLOW_RATE', 20),
      optionalComparable('ATTR_SIGNAL_TYPE', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 70),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 80),
      requiredComparable('ATTR_PIN_COUNT', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
    ],
  },
  {
    code: 'CANON_INTAKE_PRESSURE_SENSOR_V1',
    name: 'Intake / Boost Pressure Sensor Standard Criteria',
    description:
      'MAP and boost pressure sensor range, supply/output, response, fitting, sealing and connector criteria.',
    targetProductTypeCodes: ['MAP_SENSOR', 'BOOST_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_OPERATING_PRESSURE_MIN', 20),
      requiredComparable('ATTR_OPERATING_PRESSURE_MAX', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 70),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 80),
      optionalComparable('ATTR_THREAD_SIZE', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
      requiredComparable('ATTR_PIN_COUNT', 110, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 120),
      optionalComparable('ATTR_SEAL_TYPE', 130),
    ],
  },
  {
    code: 'CANON_THROTTLE_POSITION_SENSOR_V1',
    name: 'Throttle Position Sensor Standard Criteria',
    description:
      'Throttle-position sensor technology, signal, electrical range, resistance and connector criteria.',
    targetProductTypeCodes: ['THROTTLE_POSITION_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_RESISTANCE', 40),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_IDLE_AIR_CONTROL_VALVE_V1',
    name: 'Idle Air Control Valve Standard Criteria',
    description:
      'Idle-air valve architecture, ports, electrical rating, connector and mounting criteria.',
    targetProductTypeCodes: ['IDLE_AIR_CONTROL_VALVE'],
    items: [
      requiredComparable('ATTR_IDLE_CONTROL_TYPE', 10),
      optionalComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_INLET_DIAMETER', 30),
      optionalComparable('ATTR_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_INTAKE_RUNNER_CONTROL_V1',
    name: 'Intake Manifold Runner Control Standard Criteria',
    description:
      'Intake runner/swirl control architecture, actuator, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['INTAKE_MANIFOLD_RUNNER_CONTROL'],
    items: [
      requiredComparable('ATTR_RUNNER_CONTROL_TYPE', 10),
      optionalComparable('ATTR_ACTUATOR_INCLUDED', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_CONNECTOR_COUNT', 50),
      optionalComparable('ATTR_PIN_COUNT', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_TURBOCHARGER_V1',
    name: 'Turbocharger Standard Criteria',
    description:
      'Turbocharger compressor/turbine wheel geometry, A/R, bearing, flange, wastegate, cooling and rotation criteria.',
    targetProductTypeCodes: ['TURBOCHARGER'],
    items: [
      requiredComparable('ATTR_TURBOCHARGER_TYPE', 10),
      requiredComparable('ATTR_TURBO_BEARING_TYPE', 20),
      requiredComparable('ATTR_COMPRESSOR_INDUCER_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_COMPRESSOR_EXDUCER_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMPRESSOR_TRIM', 50),
      optionalComparable('ATTR_COMPRESSOR_AR_RATIO', 60),
      requiredComparable('ATTR_TURBINE_INDUCER_DIAMETER', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TURBINE_EXDUCER_DIAMETER', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TURBINE_TRIM', 90),
      requiredComparable('ATTR_TURBINE_AR_RATIO', 100, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TURBO_INLET_FLANGE', 110),
      requiredComparable('ATTR_TURBO_OUTLET_FLANGE', 120),
      requiredComparable('ATTR_TURBO_WASTEGATE_TYPE', 130),
      optionalComparable('ATTR_TURBO_DIVIDED_HOUSING', 140),
      optionalComparable('ATTR_TURBO_COOLING_TYPE', 150),
      optionalComparable('ATTR_ROTATION_DIRECTION', 160),
      optionalComparable('ATTR_TURBO_ACTUATOR_CALIBRATION_PRESSURE', 170),
    ],
  },
  {
    code: 'CANON_TURBO_ACTUATOR_V1',
    name: 'Turbocharger Actuator Standard Criteria',
    description:
      'Turbo actuator construction, stroke, calibration pressure, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['TURBO_ACTUATOR'],
    items: [
      requiredComparable('ATTR_ACTUATOR_TYPE', 10),
      optionalComparable('ATTR_ACTUATOR_STROKE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TURBO_ACTUATOR_CALIBRATION_PRESSURE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_PIN_COUNT', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_TURBO_WASTEGATE_V1',
    name: 'Turbo Wastegate Standard Criteria',
    description:
      'Turbo wastegate architecture, valve diameter, actuator calibration and mounting criteria.',
    targetProductTypeCodes: ['TURBO_WASTEGATE'],
    items: [
      requiredComparable('ATTR_TURBO_WASTEGATE_TYPE', 10),
      optionalComparable('ATTR_WASTEGATE_VALVE_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TURBO_ACTUATOR_CALIBRATION_PRESSURE', 30),
      optionalComparable('ATTR_ACTUATOR_TYPE', 40),
      optionalComparable('ATTR_ACTUATOR_STROKE', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_INTERCOOLER_V1',
    name: 'Intercooler Standard Criteria',
    description:
      'Charge-air cooler core geometry, inlet/outlet, material and pressure criteria.',
    targetProductTypeCodes: ['INTERCOOLER'],
    items: [
      requiredComparable('ATTR_INTERCOOLER_CORE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_INTERCOOLER_CORE_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_INTERCOOLER_CORE_THICKNESS', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CHARGE_AIR_INLET_DIAMETER', 40),
      requiredComparable('ATTR_CHARGE_AIR_OUTLET_DIAMETER', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 70),
    ],
  },
  {
    code: 'CANON_INTERCOOLER_HOSE_V1',
    name: 'Intercooler Hose Standard Criteria',
    description:
      'Charge-air hose length, end diameters, material and operating pressure/temperature criteria.',
    targetProductTypeCodes: ['INTERCOOLER_HOSE'],
    items: [
      requiredComparable('ATTR_CHARGE_AIR_HOSE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CHARGE_AIR_INLET_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CHARGE_AIR_OUTLET_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 50),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 60),
      optionalComparable('ATTR_CONNECTION_1', 70),
      optionalComparable('ATTR_CONNECTION_2', 80),
    ],
  },
  {
    code: 'CANON_TURBO_FLUID_LINE_V1',
    name: 'Turbo Oil / Coolant Line Standard Criteria',
    description:
      'Turbocharger oil and coolant line geometry, material, connection and operating-limit criteria.',
    targetProductTypeCodes: ['TURBO_OIL_LINE', 'TURBO_COOLANT_LINE'],
    items: [
      requiredComparable('ATTR_TURBO_LINE_LENGTH', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TURBO_LINE_INNER_DIAMETER', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_THREAD_SIZE_1', 40),
      optionalComparable('ATTR_THREAD_SIZE_2', 50),
      optionalComparable('ATTR_CONNECTION_1', 60),
      optionalComparable('ATTR_CONNECTION_2', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 90),
    ],
  },
  {
    code: 'CANON_AUTOMOTIVE_BATTERY_V1',
    name: 'Automotive Battery Standard Criteria',
    description:
      'Starting-battery electrical ratings, dimensions, polarity and terminal criteria for comparison and fitment review.',
    targetProductTypeCodes: ['AUTOMOTIVE_BATTERY'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10, { variantDefining: true }),
      requiredComparable('ATTR_BATTERY_CAPACITY', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_COLD_CRANKING_CURRENT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BATTERY_TYPE', 40),
      requiredComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      requiredComparable('ATTR_WIDTH', 60, { variantDefining: true }),
      requiredComparable('ATTR_HEIGHT', 70, { variantDefining: true }),
      requiredComparable('ATTR_POLARITY', 80, { variantDefining: true }),
      optionalComparable('ATTR_TERMINAL_TYPE', 90),
      optionalComparable('ATTR_ITEM_WEIGHT', 100),
    ],
  },
  {
    code: 'CANON_ALTERNATOR_V1',
    name: 'Alternator Standard Criteria',
    description:
      'Alternator voltage/output, regulator, pulley, mounting, rotation and connector criteria.',
    targetProductTypeCodes: ['ALTERNATOR'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10, { variantDefining: true }),
      requiredComparable('ATTR_ALTERNATOR_OUTPUT_CURRENT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_REGULATED_VOLTAGE', 30),
      optionalComparable('ATTR_ALTERNATOR_TYPE', 40),
      requiredComparable('ATTR_REGULATOR_TYPE', 50),
      requiredComparable('ATTR_PULLEY_TYPE', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PULLEY_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 80),
      optionalComparable('ATTR_ROTATION_DIRECTION', 90),
      optionalComparable('ATTR_MAX_ROTATIONAL_SPEED', 100),
      optionalComparable('ATTR_MOUNTING_LUG_COUNT', 110),
      optionalComparable('ATTR_CONNECTOR_COUNT', 120),
      optionalComparable('ATTR_PIN_COUNT', 130),
      optionalComparable('ATTR_ITEM_WEIGHT', 140),
    ],
  },
  {
    code: 'CANON_STARTER_MOTOR_V1',
    name: 'Starter Motor Standard Criteria',
    description:
      'Starter electrical rating, pinion geometry, fitting interface, rotation and solenoid criteria.',
    targetProductTypeCodes: ['STARTER_MOTOR'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10, { variantDefining: true }),
      optionalComparable('ATTR_ELECTRICAL_POWER', 20),
      optionalComparable('ATTR_STARTER_TYPE', 30),
      requiredComparable('ATTR_STARTER_PINION_TOOTH_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STARTER_PINION_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STARTER_FITTING_DIAMETER', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STARTER_OFFSET', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_ROTATION_DIRECTION', 80),
      optionalComparable('ATTR_MOUNTING_LUG_COUNT', 90),
      optionalComparable('ATTR_SOLENOID_INCLUDED', 100),
      optionalComparable('ATTR_CONNECTOR_COUNT', 110),
      optionalComparable('ATTR_TERMINAL_COUNT', 120),
    ],
  },
  {
    code: 'CANON_VOLTAGE_REGULATOR_V1',
    name: 'Voltage Regulator Standard Criteria',
    description:
      'Alternator voltage-regulator target voltage, control type and electrical interface criteria.',
    targetProductTypeCodes: ['VOLTAGE_REGULATOR'],
    items: [
      requiredComparable('ATTR_REGULATED_VOLTAGE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 20),
      requiredComparable('ATTR_REGULATOR_TYPE', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_ALTERNATOR_RECTIFIER_V1',
    name: 'Alternator Rectifier Standard Criteria',
    description:
      'Alternator rectifier electrical rating, diode count and connection criteria.',
    targetProductTypeCodes: ['ALTERNATOR_RECTIFIER'],
    items: [
      optionalComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      requiredComparable('ATTR_RECTIFIER_DIODE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TERMINAL_COUNT', 40),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
    ],
  },
  {
    code: 'CANON_STARTER_SOLENOID_V1',
    name: 'Starter Solenoid Standard Criteria',
    description:
      'Starter-solenoid voltage, switching, terminal and mounting criteria.',
    targetProductTypeCodes: ['STARTER_SOLENOID'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 20),
      optionalComparable('ATTR_SWITCH_TYPE', 30),
      requiredComparable('ATTR_TERMINAL_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_AUTOMOTIVE_FUSE_V1',
    name: 'Automotive Fuse Standard Criteria',
    description:
      'Automotive fuse form factor, current, voltage and physical-size criteria.',
    targetProductTypeCodes: ['FUSE'],
    items: [
      requiredComparable('ATTR_FUSE_TYPE', 10, { variantDefining: true }),
      requiredComparable('ATTR_FUSE_RATING', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUSE_VOLTAGE_RATING', 30),
      optionalComparable('ATTR_LENGTH', 40),
      optionalComparable('ATTR_WIDTH', 50),
      optionalComparable('ATTR_HEIGHT', 60),
      optionalComparable('ATTR_TERMINAL_COUNT', 70),
    ],
  },
  {
    code: 'CANON_FUSE_BOX_V1',
    name: 'Fuse Box Standard Criteria',
    description:
      'Fuse/power-distribution box capacity, connector, circuit and enclosure criteria.',
    targetProductTypeCodes: ['FUSE_BOX'],
    items: [
      requiredComparable('ATTR_FUSE_SLOT_COUNT', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RELAY_SLOT_COUNT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_LENGTH', 60),
      optionalComparable('ATTR_WIDTH', 70),
      optionalComparable('ATTR_HEIGHT', 80),
      optionalComparable('ATTR_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_AUTOMOTIVE_RELAY_V1',
    name: 'Automotive Relay Standard Criteria',
    description:
      'Relay coil voltage, switching current, contact form, suppression and pin criteria.',
    targetProductTypeCodes: ['RELAY'],
    items: [
      requiredComparable('ATTR_RELAY_COIL_VOLTAGE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RELAY_SWITCHING_CURRENT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RELAY_CONTACT_FORM', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RELAY_RESISTOR_INCLUDED', 50),
      optionalComparable('ATTR_RELAY_DIODE_INCLUDED', 60),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_RELAY_BOX_V1',
    name: 'Relay Box Standard Criteria',
    description:
      'Relay/power-distribution box relay/fuse capacity, circuit, connector and enclosure criteria.',
    targetProductTypeCodes: ['RELAY_BOX'],
    items: [
      requiredComparable('ATTR_RELAY_SLOT_COUNT', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUSE_SLOT_COUNT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_LENGTH', 60),
      optionalComparable('ATTR_WIDTH', 70),
      optionalComparable('ATTR_HEIGHT', 80),
      optionalComparable('ATTR_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_BATTERY_TERMINAL_V1',
    name: 'Battery Terminal Standard Criteria',
    description:
      'Battery terminal polarity, terminal interface, material and mounting-hole criteria.',
    targetProductTypeCodes: ['BATTERY_TERMINAL'],
    items: [
      requiredComparable('ATTR_POLARITY', 10),
      requiredComparable('ATTR_TERMINAL_TYPE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_TERMINAL_HOLE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE', 50),
    ],
  },
  {
    code: 'CANON_BATTERY_CABLE_V1',
    name: 'Battery Cable Standard Criteria',
    description:
      'Battery cable length, conductor size/material, insulation and terminal criteria.',
    targetProductTypeCodes: ['BATTERY_CABLE'],
    items: [
      requiredComparable('ATTR_CABLE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIRE_GAUGE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDUCTOR_MATERIAL', 30),
      optionalComparable('ATTR_INSULATION_MATERIAL', 40),
      optionalComparable('ATTR_INSULATION_COLOR', 50),
      optionalComparable('ATTR_CURRENT', 60),
      optionalComparable('ATTR_TERMINAL_TYPE', 70),
      optionalComparable('ATTR_POLARITY', 80),
    ],
  },
  {
    code: 'CANON_POSITION_SPEED_SENSOR_V1',
    name: 'Engine Position & Speed Sensor Standard Criteria',
    description:
      'Crankshaft, camshaft and vehicle-speed sensor technology, signal, electrical interface and mounting criteria.',
    targetProductTypeCodes: [
      'CRANKSHAFT_POSITION_SENSOR',
      'CAMSHAFT_POSITION_SENSOR',
      'VEHICLE_SPEED_SENSOR',
    ],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      requiredComparable('ATTR_CONNECTOR_GENDER', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CABLE_LENGTH', 60),
      optionalComparable('ATTR_RESISTANCE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_KNOCK_SENSOR_V1',
    name: 'Knock Sensor Standard Criteria',
    description:
      'Knock sensor technology, electrical interface, resistance and mounting criteria.',
    targetProductTypeCodes: ['KNOCK_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      requiredComparable('ATTR_CONNECTOR_GENDER', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RESISTANCE', 50),
      optionalComparable('ATTR_THREAD_SIZE', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_INSTALLATION_TORQUE', 80),
    ],
  },
  {
    code: 'CANON_BAROMETRIC_PRESSURE_SENSOR_V1',
    name: 'Barometric Pressure Sensor Standard Criteria',
    description:
      'Barometric pressure sensor technology, signal, pressure range and electrical-interface criteria.',
    targetProductTypeCodes: ['BAROMETRIC_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      requiredComparable('ATTR_CONNECTOR_GENDER', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OPERATING_PRESSURE_MIN', 60),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_ENGINE_CONTROL_MODULE_V1',
    name: 'Engine Control Module Standard Criteria',
    description:
      'Engine control module voltage, connector, protocol, programming and mounting criteria.',
    targetProductTypeCodes: ['ENGINE_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      requiredComparable('ATTR_CONNECTOR_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PIN_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 40),
      optionalComparable('ATTR_PROGRAMMABLE', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_IGNITION_SWITCH_V1',
    name: 'Ignition Switch Standard Criteria',
    description:
      'Ignition switch positions, contacts, electrical rating and connector criteria.',
    targetProductTypeCodes: ['IGNITION_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      requiredComparable('ATTR_SWITCH_POSITION_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONTACT_COUNT', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_CONNECTOR_COUNT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_BRAKE_LIGHT_SWITCH_V1',
    name: 'Brake Light Switch Standard Criteria',
    description:
      'Brake-light switch contact, electrical, connector and mounting criteria.',
    targetProductTypeCodes: ['BRAKE_LIGHT_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_CONTACT_COUNT', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_REVERSE_LIGHT_SWITCH_V1',
    name: 'Reverse Light Switch Standard Criteria',
    description:
      'Reverse-light switch thread, electrical contact and connector criteria.',
    targetProductTypeCodes: ['REVERSE_LIGHT_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      requiredComparable('ATTR_THREAD_SIZE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_CONTACT_COUNT', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
    ],
  },
  {
    code: 'CANON_MULTIFUNCTION_SWITCH_V1',
    name: 'Multifunction Column Switch Standard Criteria',
    description:
      'Column multifunction switch positions, circuits, connector and communication criteria.',
    targetProductTypeCodes: ['MULTIFUNCTION_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_SWITCH_POSITION_COUNT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 70),
    ],
  },
  {
    code: 'CANON_WINDOW_SWITCH_V1',
    name: 'Power Window Switch Standard Criteria',
    description:
      'Power-window switch positions, circuits, electrical rating and connector criteria.',
    targetProductTypeCodes: ['WINDOW_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_SWITCH_POSITION_COUNT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_CONTACT_COUNT', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_COUNT', 80),
    ],
  },
  {
    code: 'CANON_DOOR_JAMB_SWITCH_V1',
    name: 'Door Jamb Switch Standard Criteria',
    description:
      'Door switch contact, thread/mounting and electrical interface criteria.',
    targetProductTypeCodes: ['DOOR_JAMB_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_CONTACT_COUNT', 20),
      optionalComparable('ATTR_THREAD_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_ENGINE_WIRING_HARNESS_V1',
    name: 'Engine Wiring Harness Standard Criteria',
    description:
      'Engine-harness branch, connector, conductor, insulation and sealing criteria.',
    targetProductTypeCodes: ['ENGINE_WIRING_HARNESS'],
    items: [
      requiredComparable('ATTR_HARNESS_BRANCH_COUNT', 10),
      requiredComparable('ATTR_CONNECTOR_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CABLE_LENGTH', 30),
      optionalComparable('ATTR_WIRE_GAUGE', 40),
      optionalComparable('ATTR_CONDUCTOR_MATERIAL', 50),
      optionalComparable('ATTR_INSULATION_MATERIAL', 60),
      optionalComparable('ATTR_SEALED_CONNECTOR', 70),
    ],
  },
  {
    code: 'CANON_SENSOR_CONNECTOR_V1',
    name: 'Sensor Connector Standard Criteria',
    description:
      'Sensor connector gender, pin/terminal, sealing and repair-lead criteria.',
    targetProductTypeCodes: ['SENSOR_CONNECTOR'],
    items: [
      requiredComparable('ATTR_CONNECTOR_GENDER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PIN_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TERMINAL_TYPE', 30),
      optionalComparable('ATTR_SEALED_CONNECTOR', 40),
      optionalComparable('ATTR_CABLE_LENGTH', 50),
      optionalComparable('ATTR_WIRE_GAUGE', 60),
      optionalComparable('ATTR_INSULATION_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_REPAIR_WIRE_V1',
    name: 'Electrical Repair Wire Standard Criteria',
    description:
      'Automotive repair wire conductor, gauge, insulation, color, terminal and length criteria.',
    targetProductTypeCodes: ['REPAIR_WIRE'],
    items: [
      requiredComparable('ATTR_CABLE_LENGTH', 10),
      requiredComparable('ATTR_WIRE_GAUGE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDUCTOR_MATERIAL', 30),
      requiredComparable('ATTR_INSULATION_MATERIAL', 40),
      optionalComparable('ATTR_INSULATION_COLOR', 50),
      optionalComparable('ATTR_TERMINAL_TYPE', 60),
    ],
  },
  {
    code: 'CANON_GROUND_STRAP_V1',
    name: 'Ground Strap Standard Criteria',
    description:
      'Electrical ground strap length, conductor, gauge and terminal-hole geometry criteria.',
    targetProductTypeCodes: ['GROUND_STRAP'],
    items: [
      requiredComparable('ATTR_CABLE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIRE_GAUGE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDUCTOR_MATERIAL', 30),
      requiredComparable('ATTR_TERMINAL_HOLE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CURRENT', 50),
    ],
  },
  {
    code: 'CANON_SHOCK_ABSORBER_V1',
    name: 'Shock Absorber Standard Criteria',
    description:
      'Shock absorber construction, mounting interfaces and physical travel criteria. Dimensions identify hardware but do not replace vehicle fitment.',
    targetProductTypeCodes: ['SHOCK_ABSORBER'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_SHOCK_TYPE', 30),
      requiredComparable('ATTR_SHOCK_EXTENDED_LENGTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_COMPRESSED_LENGTH', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_STROKE', 60),
      requiredComparable('ATTR_SHOCK_UPPER_MOUNT_TYPE', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_LOWER_MOUNT_TYPE', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHOCK_BODY_DIAMETER', 90),
      optionalComparable('ATTR_PISTON_ROD_DIAMETER', 100),
      optionalComparable('ATTR_DUST_BOOT_INCLUDED', 110),
      optionalComparable('ATTR_BUMP_STOP_INCLUDED', 120),
    ],
  },
  {
    code: 'CANON_STRUT_ASSEMBLY_V1',
    name: 'Strut Assembly Standard Criteria',
    description:
      'Complete suspension strut construction, travel, mounting and included-component criteria.',
    targetProductTypeCodes: ['STRUT_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_SHOCK_TYPE', 30),
      optionalComparable('ATTR_SHOCK_EXTENDED_LENGTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHOCK_COMPRESSED_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHOCK_STROKE', 60),
      requiredComparable('ATTR_SHOCK_UPPER_MOUNT_TYPE', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_LOWER_MOUNT_TYPE', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHOCK_BODY_DIAMETER', 90),
      optionalComparable('ATTR_PISTON_ROD_DIAMETER', 100),
      optionalComparable('ATTR_SPRING_INCLUDED', 110),
      optionalComparable('ATTR_STRUT_MOUNT_INCLUDED', 120),
      optionalComparable('ATTR_BEARING_INCLUDED', 130),
      optionalComparable('ATTR_DUST_BOOT_INCLUDED', 140),
      optionalComparable('ATTR_BUMP_STOP_INCLUDED', 150),
    ],
  },
  {
    code: 'CANON_STRUT_MOUNT_V1',
    name: 'Strut Mount Standard Criteria',
    description:
      'Upper strut mount geometry, installation interface and integrated-bearing criteria.',
    targetProductTypeCodes: ['STRUT_MOUNT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_MOUNTING_TYPE', 30),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_STUD_COUNT', 80),
      optionalComparable('ATTR_BEARING_INCLUDED', 90),
      optionalComparable('ATTR_BUSHING_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_STRUT_BEARING_V1',
    name: 'Strut Bearing Standard Criteria',
    description:
      'Strut bearing construction and physical geometry criteria.',
    targetProductTypeCodes: ['STRUT_BEARING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_BEARING_TYPE', 30),
      requiredComparable('ATTR_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_TYPE', 70),
    ],
  },
  {
    code: 'CANON_SHOCK_DUST_BOOT_V1',
    name: 'Shock Dust Boot Standard Criteria',
    description:
      'Shock and strut protective boot dimensions, material and included bump-stop criteria.',
    targetProductTypeCodes: ['SHOCK_DUST_BOOT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_BUMP_STOP_INCLUDED', 70),
    ],
  },
  {
    code: 'CANON_BUMP_STOP_V1',
    name: 'Suspension Bump Stop Standard Criteria',
    description:
      'Suspension bump-stop geometry, material and installation-position criteria.',
    targetProductTypeCodes: ['BUMP_STOP'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_HEIGHT', 30, { variantDefining: true }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_SHOCK_MOUNT_V1',
    name: 'Shock Absorber Mount Standard Criteria',
    description:
      'Shock mount geometry, mounting interface, material and installation-position criteria.',
    targetProductTypeCodes: ['SHOCK_MOUNT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_MOUNTING_TYPE', 30),
      optionalComparable('ATTR_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_STUD_COUNT', 80),
      optionalComparable('ATTR_BUSHING_MATERIAL', 90),
      optionalComparable('ATTR_BEARING_INCLUDED', 100),
    ],
  },
  {
    code: 'CANON_COIL_SPRING_V1',
    name: 'Coil Spring Standard Criteria',
    description:
      'Coil spring free geometry, wire size, design and rate criteria. Vehicle load/application remains structured fitment.',
    targetProductTypeCodes: ['COIL_SPRING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_SPRING_TYPE', 30),
      optionalComparable('ATTR_SPRING_DESIGN', 40),
      requiredComparable('ATTR_SPRING_FREE_LENGTH', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPRING_OUTER_DIAMETER', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPRING_WIRE_DIAMETER', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPRING_COIL_COUNT', 80),
      optionalComparable('ATTR_SPRING_RATE', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_LEAF_SPRING_V1',
    name: 'Leaf Spring Standard Criteria',
    description:
      'Leaf-spring pack geometry, leaf count, rate, material and bushing-supply criteria.',
    targetProductTypeCodes: ['LEAF_SPRING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_SPRING_TYPE', 30),
      requiredComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      requiredComparable('ATTR_LEAF_SPRING_WIDTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LEAF_SPRING_THICKNESS', 60),
      requiredComparable('ATTR_LEAF_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPRING_RATE', 80),
      optionalComparable('ATTR_BUSHING_INCLUDED', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_AIR_SPRING_V1',
    name: 'Air Spring Standard Criteria',
    description:
      'Pneumatic suspension spring geometry, pressure, fluid-interface and material criteria.',
    targetProductTypeCodes: ['AIR_SPRING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_SPRING_TYPE', 30),
      requiredComparable('ATTR_AIR_SPRING_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AIR_SPRING_MIN_HEIGHT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AIR_SPRING_MAX_HEIGHT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PORT_COUNT', 70),
      optionalComparable('ATTR_THREAD_SIZE', 80),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_TORSION_BAR_V1',
    name: 'Torsion Bar Standard Criteria',
    description:
      'Torsion-bar geometry, rate and material criteria.',
    targetProductTypeCodes: ['TORSION_BAR'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_TORSION_BAR_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPRING_RATE', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_SPRING_SEAT_V1',
    name: 'Spring Seat Standard Criteria',
    description:
      'Suspension spring-seat geometry, material and installation-position criteria.',
    targetProductTypeCodes: ['SPRING_SEAT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_SPRING_PAD_V1',
    name: 'Spring Pad Standard Criteria',
    description:
      'Spring isolator/pad geometry, thickness, material and installation-position criteria.',
    targetProductTypeCodes: ['SPRING_PAD'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THICKNESS', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_CONTROL_ARM_V1',
    name: 'Control Arm Standard Criteria',
    description:
      'Control-arm position, geometry, material and integrated joint/bushing criteria.',
    targetProductTypeCodes: ['CONTROL_ARM'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_CONTROL_ARM_POSITION', 30),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_CENTER_DISTANCE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_BALL_JOINT_INCLUDED', 80),
      optionalComparable('ATTR_BUSHING_INCLUDED', 90),
    ],
  },
  {
    code: 'CANON_BALL_JOINT_V1',
    name: 'Ball Joint Standard Criteria',
    description:
      'Suspension ball-joint taper, thread, mounting and position criteria.',
    targetProductTypeCodes: ['BALL_JOINT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_POSITION', 30),
      requiredComparable('ATTR_BALL_JOINT_CONE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_SIZE', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_STUD_COUNT', 90),
    ],
  },
  {
    code: 'CANON_CONTROL_ARM_BUSHING_V1',
    name: 'Control Arm Bushing Standard Criteria',
    description:
      'Control-arm bushing material and press-fit geometry criteria.',
    targetProductTypeCodes: ['CONTROL_ARM_BUSHING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      optionalComparable('ATTR_POSITION', 30),
      requiredComparable('ATTR_BUSHING_MATERIAL', 40),
      requiredComparable('ATTR_BUSHING_INNER_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BUSHING_OUTER_DIAMETER', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BUSHING_LENGTH', 70, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_TRAILING_ARM_V1',
    name: 'Trailing Arm Standard Criteria',
    description:
      'Trailing-arm geometry, material, bushing and mounting criteria.',
    targetProductTypeCodes: ['TRAILING_ARM'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_CENTER_DISTANCE', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BUSHING_INCLUDED', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_LATERAL_LINK_V1',
    name: 'Lateral Link Standard Criteria',
    description:
      'Lateral suspension-link geometry, material, joint and bushing criteria.',
    targetProductTypeCodes: ['LATERAL_LINK'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_SUSPENSION_LINK_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_BALL_JOINT_INCLUDED', 50),
      optionalComparable('ATTR_BUSHING_INCLUDED', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
    ],
  },
  {
    code: 'CANON_SUSPENSION_KNUCKLE_V1',
    name: 'Steering Knuckle Standard Criteria',
    description:
      'Suspension/steering knuckle material, hub interface and mounting criteria.',
    targetProductTypeCodes: ['SUSPENSION_KNUCKLE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_CENTER_BORE', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
      optionalComparable('ATTR_BOLT_COUNT', 60),
      optionalComparable('ATTR_BEARING_INCLUDED', 70),
    ],
  },
  {
    code: 'CANON_STABILIZER_LINK_V1',
    name: 'Stabilizer Link Standard Criteria',
    description:
      'Anti-roll-bar link length, end connections, thread and installation-position criteria.',
    targetProductTypeCodes: ['STABILIZER_LINK'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_SUSPENSION_LINK_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTION_1', 40),
      optionalComparable('ATTR_CONNECTION_2', 50),
      optionalComparable('ATTR_THREAD_SIZE_1', 60),
      optionalComparable('ATTR_THREAD_SIZE_2', 70),
      optionalComparable('ATTR_STUD_COUNT', 80),
    ],
  },
  {
    code: 'CANON_STABILIZER_BUSHING_V1',
    name: 'Stabilizer Bar Bushing Standard Criteria',
    description:
      'Anti-roll-bar bushing bore, outside geometry, length and material criteria.',
    targetProductTypeCodes: ['STABILIZER_BUSHING'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_BUSHING_INNER_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BUSHING_OUTER_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BUSHING_LENGTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BUSHING_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_STABILIZER_BAR_V1',
    name: 'Stabilizer Bar Standard Criteria',
    description:
      'Anti-roll-bar diameter, length, material and installation-position criteria.',
    targetProductTypeCodes: ['STABILIZER_BAR'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_STABILIZER_BAR_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STABILIZER_BAR_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_TIE_ROD_END_V1',
    name: 'Tie Rod End Standard Criteria',
    description:
      'Tie-rod end geometry, ball-stud taper and threaded adjustment interface criteria. Vehicle application remains structured fitment.',
    targetProductTypeCodes: ['TIE_ROD_END'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_TIE_ROD_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIE_ROD_STUD_CONE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIE_ROD_THREAD_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIE_ROD_THREAD_PITCH', 60),
      optionalComparable('ATTR_THREAD_DIRECTION', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_INNER_TIE_ROD_V1',
    name: 'Inner Tie Rod Standard Criteria',
    description:
      'Inner tie-rod/rack-end length, rack/outer thread interfaces and joint geometry criteria.',
    targetProductTypeCodes: ['INNER_TIE_ROD'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_TIE_ROD_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_SIZE_1', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_SIZE_2', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIE_ROD_THREAD_PITCH', 60),
      optionalComparable('ATTR_BALL_JOINT_CONE_DIAMETER', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_STEERING_CENTER_LINK_V1',
    name: 'Steering Center Link Standard Criteria',
    description:
      'Steering center-link length, joint count, threaded interfaces and material criteria.',
    targetProductTypeCodes: ['CENTER_LINK'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SUSPENSION_LINK_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_LINK_JOINT_COUNT', 30),
      optionalComparable('ATTR_THREAD_SIZE_1', 40),
      optionalComparable('ATTR_THREAD_SIZE_2', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_IDLER_ARM_V1',
    name: 'Idler Arm Standard Criteria',
    description:
      'Steering idler-arm center distance, pivot bore, mounting and material criteria.',
    targetProductTypeCodes: ['IDLER_ARM'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_STEERING_ARM_CENTER_DISTANCE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_ARM_BORE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 40),
      optionalComparable('ATTR_STUD_COUNT', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_PITMAN_ARM_V1',
    name: 'Pitman Arm Standard Criteria',
    description:
      'Pitman-arm center distance, sector-shaft bore/splines and material criteria.',
    targetProductTypeCodes: ['PITMAN_ARM'],
    items: [
      requiredComparable('ATTR_STEERING_ARM_CENTER_DISTANCE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_ARM_BORE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_ARM_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BALL_JOINT_CONE_DIAMETER', 40),
      requiredComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_STEERING_DAMPER_V1',
    name: 'Steering Damper Standard Criteria',
    description:
      'Steering damper construction, extended/compressed geometry, stroke and mounting criteria.',
    targetProductTypeCodes: ['STEERING_DAMPER'],
    items: [
      requiredComparable('ATTR_SHOCK_TYPE', 10),
      requiredComparable('ATTR_SHOCK_EXTENDED_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_COMPRESSED_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_STROKE', 40),
      requiredComparable('ATTR_SHOCK_UPPER_MOUNT_TYPE', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHOCK_LOWER_MOUNT_TYPE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHOCK_BODY_DIAMETER', 70),
      optionalComparable('ATTR_PISTON_ROD_DIAMETER', 80),
    ],
  },
  {
    code: 'CANON_STEERING_RACK_V1',
    name: 'Steering Rack Standard Criteria',
    description:
      'Steering rack architecture, overall length, travel, input pinion and steering-ratio criteria.',
    targetProductTypeCodes: ['STEERING_RACK'],
    items: [
      requiredComparable('ATTR_STEERING_RACK_TYPE', 10),
      requiredComparable('ATTR_STEERING_RACK_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_RACK_TRAVEL', 30),
      requiredComparable('ATTR_STEERING_PINION_SPLINE_COUNT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_PINION_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_RATIO', 60),
      optionalComparable('ATTR_PORT_COUNT', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
    ],
  },
  {
    code: 'CANON_STEERING_GEARBOX_V1',
    name: 'Steering Gearbox Standard Criteria',
    description:
      'Steering gearbox construction, steering ratio, input/output shaft geometry and hydraulic interface criteria.',
    targetProductTypeCodes: ['STEERING_GEARBOX'],
    items: [
      requiredComparable('ATTR_STEERING_GEAR_TYPE', 10),
      optionalComparable('ATTR_STEERING_RATIO', 20),
      requiredComparable('ATTR_STEERING_GEAR_INPUT_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_GEAR_INPUT_SPLINE_COUNT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_GEAR_OUTPUT_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_GEAR_OUTPUT_SPLINE_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PORT_COUNT', 70),
      optionalComparable('ATTR_POWER_STEERING_PRESSURE', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_STEERING_RACK_BOOT_V1',
    name: 'Steering Rack Boot Standard Criteria',
    description:
      'Steering rack bellows length, small/large clamping diameters and material criteria.',
    targetProductTypeCodes: ['STEERING_RACK_BOOT'],
    items: [
      requiredComparable('ATTR_STEERING_BOOT_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_BOOT_SMALL_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_STEERING_BOOT_LARGE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_STEERING_RACK_MOUNT_V1',
    name: 'Steering Rack Mount Standard Criteria',
    description:
      'Steering rack mount/bushing geometry, material and mounting criteria.',
    targetProductTypeCodes: ['STEERING_RACK_MOUNT'],
    items: [
      requiredComparable('ATTR_BUSHING_MATERIAL', 10),
      optionalComparable('ATTR_BUSHING_INNER_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BUSHING_OUTER_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BUSHING_LENGTH', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
    ],
  },
  {
    code: 'CANON_STEERING_RACK_REPAIR_KIT_V1',
    name: 'Steering Rack Repair Kit Standard Criteria',
    description:
      'Steering rack repair-kit rack type, sealing material and package-content criteria.',
    targetProductTypeCodes: ['STEERING_RACK_REPAIR_KIT'],
    items: [
      requiredComparable('ATTR_STEERING_RACK_TYPE', 10),
      optionalComparable('ATTR_SEAL_TYPE', 20),
      optionalComparable('ATTR_SEAL_MATERIAL', 30),
    ],
  },
  {
    code: 'CANON_POWER_STEERING_PUMP_V1',
    name: 'Power Steering Pump Standard Criteria',
    description:
      'Hydraulic steering pump type, flow, pressure, pulley, rotation and fluid-interface criteria.',
    targetProductTypeCodes: ['POWER_STEERING_PUMP'],
    items: [
      requiredComparable('ATTR_POWER_STEERING_PUMP_TYPE', 10),
      requiredComparable('ATTR_POWER_STEERING_FLOW_RATE', 20),
      requiredComparable('ATTR_POWER_STEERING_PRESSURE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_TYPE', 40),
      optionalComparable('ATTR_PULLEY_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 60),
      optionalComparable('ATTR_ROTATION_DIRECTION', 70),
      optionalComparable('ATTR_INLET_DIAMETER', 80),
      optionalComparable('ATTR_OUTLET_DIAMETER', 90),
      optionalComparable('ATTR_POWER_STEERING_RESERVOIR_INCLUDED', 100),
    ],
  },
  {
    code: 'CANON_POWER_STEERING_HOSE_V1',
    name: 'Power Steering Hose Standard Criteria',
    description:
      'Power-steering hose function, length, bore, pressure and end-connection criteria.',
    targetProductTypeCodes: ['POWER_STEERING_HOSE'],
    items: [
      requiredComparable('ATTR_POWER_STEERING_HOSE_TYPE', 10),
      requiredComparable('ATTR_POWER_STEERING_HOSE_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_POWER_STEERING_HOSE_INNER_DIAMETER', 30),
      requiredComparable('ATTR_POWER_STEERING_HOSE_PRESSURE', 40),
      optionalComparable('ATTR_CONNECTION_1', 50),
      optionalComparable('ATTR_CONNECTION_2', 60),
      optionalComparable('ATTR_THREAD_SIZE_1', 70),
      optionalComparable('ATTR_THREAD_SIZE_2', 80),
      requiredComparable('ATTR_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_POWER_STEERING_RESERVOIR_V1',
    name: 'Power Steering Reservoir Standard Criteria',
    description:
      'Power-steering reservoir capacity, port count, material and integrated-filter criteria.',
    targetProductTypeCodes: ['POWER_STEERING_RESERVOIR'],
    items: [
      requiredComparable('ATTR_POWER_STEERING_RESERVOIR_CAPACITY', 10),
      requiredComparable('ATTR_POWER_STEERING_RESERVOIR_PORT_COUNT', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_POWER_STEERING_FILTER_INCLUDED', 40),
      optionalComparable('ATTR_LENGTH', 50),
      optionalComparable('ATTR_WIDTH', 60),
      optionalComparable('ATTR_HEIGHT', 70),
    ],
  },
  {
    code: 'CANON_EPS_MOTOR_V1',
    name: 'Electric Power Steering Motor Standard Criteria',
    description:
      'EPS motor architecture, electrical rating, power/torque, connector, communication and mounting criteria.',
    targetProductTypeCodes: ['ELECTRIC_POWER_STEERING_MOTOR'],
    items: [
      requiredComparable('ATTR_EPS_MOTOR_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_ELECTRICAL_POWER', 40),
      optionalComparable('ATTR_EPS_MOTOR_TORQUE', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_STEERING_ANGLE_SENSOR_V1',
    name: 'Steering Angle Sensor Standard Criteria',
    description:
      'Steering-angle sensor technology, angular range/resolution, electrical interface and communication criteria.',
    targetProductTypeCodes: ['STEERING_ANGLE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      requiredComparable('ATTR_STEERING_ANGLE_RANGE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_ANGLE_RESOLUTION', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 80),
    ],
  },
  {
    code: 'CANON_STEERING_COLUMN_V1',
    name: 'Steering Column Standard Criteria',
    description:
      'Steering-column construction, length, input/output splines and adjustment criteria.',
    targetProductTypeCodes: ['STEERING_COLUMN'],
    items: [
      requiredComparable('ATTR_STEERING_COLUMN_TYPE', 10),
      requiredComparable('ATTR_STEERING_COLUMN_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_COLUMN_INPUT_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_COLUMN_OUTPUT_SPLINE_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_STEERING_COLUMN_TILT', 50),
      optionalComparable('ATTR_STEERING_COLUMN_TELESCOPIC', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_RADIATOR_V1',
    name: 'Radiator Standard Criteria',
    description:
      'Radiator core geometry, rows, hose interfaces, material and cooling pressure criteria.',
    targetProductTypeCodes: ['RADIATOR'],
    items: [
      requiredComparable('ATTR_RADIATOR_CORE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RADIATOR_CORE_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RADIATOR_CORE_THICKNESS', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RADIATOR_ROW_COUNT', 40),
      requiredComparable('ATTR_INLET_DIAMETER', 50),
      requiredComparable('ATTR_OUTLET_DIAMETER', 60),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_COOLING_PRESSURE_RATING', 80),
    ],
  },
  {
    code: 'CANON_COOLANT_EXPANSION_TANK_V1',
    name: 'Coolant Expansion Tank Standard Criteria',
    description:
      'Coolant reservoir capacity, geometry, hose interfaces, material and pressure criteria.',
    targetProductTypeCodes: ['COOLANT_EXPANSION_TANK'],
    items: [
      requiredComparable('ATTR_COOLANT_TANK_CAPACITY', 10),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_INLET_DIAMETER', 50),
      optionalComparable('ATTR_OUTLET_DIAMETER', 60),
      optionalComparable('ATTR_COOLING_PRESSURE_RATING', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_SENSOR_PORT_COUNT', 90),
    ],
  },
  {
    code: 'CANON_RADIATOR_CAP_V1',
    name: 'Radiator Cap Standard Criteria',
    description:
      'Radiator/expansion cap pressure-control, recovery-system and filler-neck geometry criteria.',
    targetProductTypeCodes: ['RADIATOR_CAP'],
    items: [
      requiredComparable('ATTR_COOLANT_RECOVERY_SYSTEM', 10),
      requiredComparable('ATTR_COOLING_PRESSURE_RATING', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FILLER_NECK_DEPTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FILLER_NECK_INNER_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FILLER_NECK_OUTER_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CAP_SHELL_DIAMETER', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_COOLANT_HOSE_V1',
    name: 'Coolant Hose Standard Criteria',
    description:
      'Coolant-hose centerline length, end diameters, branch construction, material and temperature criteria.',
    targetProductTypeCodes: ['COOLANT_HOSE'],
    items: [
      requiredComparable('ATTR_HOSE_CENTERLINE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_1', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_2', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HOSE_INNER_DIAMETER_3', 40),
      optionalComparable('ATTR_HOSE_BRANCH_COUNT', 50),
      optionalComparable('ATTR_MODULAR_HOSE', 60),
      optionalComparable('ATTR_HOSE_SPRING_INCLUDED', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 90),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
      optionalComparable('ATTR_CONNECTION_1', 110),
      optionalComparable('ATTR_CONNECTION_2', 120),
    ],
  },
  {
    code: 'CANON_RADIATOR_HOSE_V1',
    name: 'Radiator Hose Standard Criteria',
    description:
      'Radiator-hose centerline length, end diameters, modular construction and material criteria.',
    targetProductTypeCodes: ['RADIATOR_HOSE'],
    items: [
      requiredComparable('ATTR_HOSE_CENTERLINE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_1', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_2', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HOSE_INNER_DIAMETER_3', 40),
      optionalComparable('ATTR_HOSE_BRANCH_COUNT', 50),
      optionalComparable('ATTR_MODULAR_HOSE', 60),
      optionalComparable('ATTR_HOSE_SPRING_INCLUDED', 70),
      requiredComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_CONNECTION_1', 90),
      optionalComparable('ATTR_CONNECTION_2', 100),
    ],
  },
  {
    code: 'CANON_HEATER_HOSE_V1',
    name: 'Heater Hose Standard Criteria',
    description:
      'Heater-hose centerline length, end diameters, branch construction, material and operating-temperature criteria.',
    targetProductTypeCodes: ['HEATER_HOSE'],
    items: [
      requiredComparable('ATTR_HOSE_CENTERLINE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_1', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HOSE_INNER_DIAMETER_2', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HOSE_INNER_DIAMETER_3', 40),
      optionalComparable('ATTR_HOSE_BRANCH_COUNT', 50),
      optionalComparable('ATTR_MODULAR_HOSE', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 90),
    ],
  },
  {
    code: 'CANON_COOLANT_FLANGE_V1',
    name: 'Coolant Flange Standard Criteria',
    description:
      'Coolant flange material, outlet geometry, sensor interfaces and mounting criteria.',
    targetProductTypeCodes: ['COOLANT_FLANGE'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      requiredComparable('ATTR_COOLANT_OUTLET_COUNT', 20),
      optionalComparable('ATTR_COOLANT_OUTLET_DIAMETER_1', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COOLANT_OUTLET_DIAMETER_2', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SENSOR_PORT_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_GASKET_INCLUDED', 70),
    ],
  },
  {
    code: 'CANON_WATER_PUMP_V1',
    name: 'Water Pump Standard Criteria',
    description:
      'Engine water-pump drive, impeller, fluid-interface and mounting criteria.',
    targetProductTypeCodes: ['WATER_PUMP'],
    items: [
      requiredComparable('ATTR_PUMP_TYPE', 10),
      requiredComparable('ATTR_WATER_PUMP_DRIVE_TYPE', 20),
      optionalComparable('ATTR_IMPELLER_MATERIAL', 30),
      optionalComparable('ATTR_PULLEY_INCLUDED', 40),
      optionalComparable('ATTR_INLET_DIAMETER', 50),
      optionalComparable('ATTR_OUTLET_DIAMETER', 60),
      optionalComparable('ATTR_FLOW_RATE', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_GASKET_INCLUDED', 90),
    ],
  },
  {
    code: 'CANON_THERMOSTAT_V1',
    name: 'Engine Thermostat Standard Criteria',
    description:
      'Thermostat calibration, bypass geometry, valve/bleed and sealing criteria.',
    targetProductTypeCodes: ['THERMOSTAT'],
    items: [
      requiredComparable('ATTR_THERMOSTAT_OPENING_TEMPERATURE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THERMOSTAT_BYPASS_FLANGE_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_HEIGHT', 30),
      optionalComparable('ATTR_JIGGLE_PIN_INCLUDED', 40),
      optionalComparable('ATTR_CHECK_VALVE_INCLUDED', 50),
      optionalComparable('ATTR_SEAL_TYPE', 60),
      optionalComparable('ATTR_GASKET_INCLUDED', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_THERMOSTAT_HOUSING_V1',
    name: 'Thermostat Housing Standard Criteria',
    description:
      'Thermostat housing material, integrated calibration, coolant outlets, sensor ports and mounting criteria.',
    targetProductTypeCodes: ['THERMOSTAT_HOUSING'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_THERMOSTAT_OPENING_TEMPERATURE', 20),
      requiredComparable('ATTR_COOLANT_OUTLET_COUNT', 30),
      optionalComparable('ATTR_COOLANT_OUTLET_DIAMETER_1', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COOLANT_OUTLET_DIAMETER_2', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SENSOR_PORT_COUNT', 60),
      optionalComparable('ATTR_CHECK_VALVE_INCLUDED', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_GASKET_INCLUDED', 90),
    ],
  },
  {
    code: 'CANON_AUXILIARY_WATER_PUMP_V1',
    name: 'Auxiliary Water Pump Standard Criteria',
    description:
      'Electric/auxiliary coolant-pump type, electrical, hydraulic and connector criteria.',
    targetProductTypeCodes: ['AUXILIARY_WATER_PUMP'],
    items: [
      requiredComparable('ATTR_PUMP_TYPE', 10),
      optionalComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_INLET_DIAMETER', 40),
      optionalComparable('ATTR_OUTLET_DIAMETER', 50),
      optionalComparable('ATTR_FLOW_RATE', 60),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 70),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_PIN_COUNT', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_COOLANT_CONTROL_VALVE_V1',
    name: 'Coolant Control Valve Standard Criteria',
    description:
      'Coolant control-valve architecture, ports, electrical actuator and connector criteria.',
    targetProductTypeCodes: ['COOLANT_CONTROL_VALVE'],
    items: [
      requiredComparable('ATTR_COOLANT_VALVE_TYPE', 10),
      requiredComparable('ATTR_PORT_COUNT', 20),
      optionalComparable('ATTR_INLET_DIAMETER', 30),
      optionalComparable('ATTR_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_PIN_COUNT', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_COOLING_FAN_V1',
    name: 'Cooling Fan Standard Criteria',
    description:
      'Cooling-fan physical, electrical, blade and rotation criteria.',
    targetProductTypeCodes: ['COOLING_FAN'],
    items: [
      requiredComparable('ATTR_FAN_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FAN_BLADE_COUNT', 20),
      optionalComparable('ATTR_VOLTAGE', 30, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_ELECTRICAL_POWER', 50),
      optionalComparable('ATTR_ROTATION_DIRECTION', 60),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_PIN_COUNT', 80),
    ],
  },
  {
    code: 'CANON_RADIATOR_FAN_ASSEMBLY_V1',
    name: 'Radiator Fan Assembly Standard Criteria',
    description:
      'Complete radiator fan module fan-count, fan geometry, electrical and included-component criteria.',
    targetProductTypeCodes: ['RADIATOR_FAN_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_FAN_COUNT', 10),
      requiredComparable('ATTR_FAN_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FAN_BLADE_COUNT', 30),
      optionalComparable('ATTR_VOLTAGE', 40, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 50),
      optionalComparable('ATTR_ROTATION_DIRECTION', 60),
      optionalComparable('ATTR_SHROUD_INCLUDED', 70),
      optionalComparable('ATTR_CONTROL_MODULE_INCLUDED', 80),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
      optionalComparable('ATTR_PIN_COUNT', 100),
    ],
  },
  {
    code: 'CANON_FAN_CLUTCH_V1',
    name: 'Fan Clutch Standard Criteria',
    description:
      'Cooling fan clutch construction, coupling diameter, mounting and rotation criteria.',
    targetProductTypeCodes: ['FAN_CLUTCH'],
    items: [
      requiredComparable('ATTR_FAN_CLUTCH_TYPE', 10),
      requiredComparable('ATTR_FAN_CLUTCH_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 30),
      optionalComparable('ATTR_BOLT_COUNT', 40),
      optionalComparable('ATTR_ROTATION_DIRECTION', 50),
      optionalComparable('ATTR_MAX_SPEED', 60),
    ],
  },
  {
    code: 'CANON_FAN_SHROUD_V1',
    name: 'Fan Shroud Standard Criteria',
    description:
      'Cooling-fan shroud opening geometry, overall dimensions, material and mounting criteria.',
    targetProductTypeCodes: ['FAN_SHROUD'],
    items: [
      requiredComparable('ATTR_FAN_OPENING_DIAMETER', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 40, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
    ],
  },
  {
    code: 'CANON_COOLANT_TEMPERATURE_SENSOR_V1',
    name: 'Coolant Temperature Sensor Standard Criteria',
    description:
      'Coolant temperature sensor mechanical interface, electrical connector and operating-range criteria.',
    targetProductTypeCodes: ['COOLANT_TEMPERATURE_SENSOR'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 20),
      requiredComparable('ATTR_CONNECTOR_GENDER', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RESISTANCE', 50),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 60),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 70),
    ],
  },
  {
    code: 'CANON_FAN_SWITCH_V1',
    name: 'Cooling Fan Switch Standard Criteria',
    description:
      'Cooling fan switch temperature thresholds, thread and electrical connector criteria.',
    targetProductTypeCodes: ['FAN_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_ON_TEMPERATURE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SWITCH_OFF_TEMPERATURE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
    ],
  },
  {
    code: 'CANON_FAN_CONTROL_MODULE_V1',
    name: 'Fan Control Module Standard Criteria',
    description:
      'Electronic cooling fan controller electrical, connector, channel and mounting criteria.',
    targetProductTypeCodes: ['FAN_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 20),
      requiredComparable('ATTR_CONNECTOR_GENDER', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONTROL_CHANNEL_COUNT', 50),
      optionalComparable('ATTR_MOUNTING_TYPE', 60),
    ],
  },
  {
    code: 'CANON_CV_AXLE_V1',
    name: 'CV Axle Standard Criteria',
    description:
      'Complete CV axle geometry, spline interfaces, shaft length and installation-position criteria. Exact vehicle compatibility remains structured fitment.',
    targetProductTypeCodes: ['CV_AXLE'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_DRIVE_SHAFT_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CV_OUTER_SPLINE_COUNT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CV_INNER_SPLINE_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DRIVE_SHAFT_DIAMETER', 60),
      optionalComparable('ATTR_CV_JOINT_TYPE', 70),
      optionalComparable('ATTR_THREAD_SIZE', 80),
      optionalComparable('ATTR_THREAD_PITCH', 90),
    ],
  },
  {
    code: 'CANON_CV_JOINT_V1',
    name: 'CV Joint Standard Criteria',
    description:
      'Constant-velocity joint construction, spline, geometry, articulation, plunge and kit-content criteria.',
    targetProductTypeCodes: ['CV_JOINT'],
    items: [
      requiredComparable('ATTR_CV_JOINT_TYPE', 10),
      requiredComparable('ATTR_CV_OUTER_SPLINE_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CV_INNER_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_OUTER_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_INNER_DIAMETER', 50),
      optionalComparable('ATTR_CV_JOINT_LENGTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_MAX_ARTICULATION_ANGLE', 70),
      optionalComparable('ATTR_CV_PLUNGE_LENGTH', 80),
      optionalComparable('ATTR_GREASE_INCLUDED', 90),
      optionalComparable('ATTR_SNAP_RING_INCLUDED', 100),
      optionalComparable('ATTR_SNAP_RING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_CV_BOOT_KIT_V1',
    name: 'CV Boot Kit Standard Criteria',
    description:
      'CV boot small/large clamping diameters, length, material and supplied grease/hardware criteria.',
    targetProductTypeCodes: ['CV_BOOT_KIT'],
    items: [
      requiredComparable('ATTR_CV_BOOT_SMALL_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CV_BOOT_LARGE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CV_BOOT_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_GREASE_INCLUDED', 50),
      optionalComparable('ATTR_SNAP_RING_INCLUDED', 60),
    ],
  },
  {
    code: 'CANON_CV_AXLE_NUT_V1',
    name: 'CV Axle Nut Standard Criteria',
    description:
      'Axle/hub nut thread, pitch, hex, height, locking style and material criteria.',
    targetProductTypeCodes: ['CV_AXLE_NUT'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AXLE_NUT_HEX_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AXLE_NUT_HEIGHT', 40),
      requiredComparable('ATTR_AXLE_NUT_STYLE', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_TRIPOD_JOINT_V1',
    name: 'Tripod Joint Standard Criteria',
    description:
      'Tripod-style plunging joint spline, housing geometry, length and axial travel criteria.',
    targetProductTypeCodes: ['TRIPOD_JOINT'],
    items: [
      requiredComparable('ATTR_CV_JOINT_TYPE', 10),
      requiredComparable('ATTR_CV_INNER_SPLINE_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_OUTER_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_INNER_DIAMETER', 40),
      optionalComparable('ATTR_CV_JOINT_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CV_PLUNGE_LENGTH', 60),
      optionalComparable('ATTR_GREASE_INCLUDED', 70),
      optionalComparable('ATTR_SNAP_RING_INCLUDED', 80),
    ],
  },
  {
    code: 'CANON_PROPELLER_SHAFT_V1',
    name: 'Propeller Shaft Standard Criteria',
    description:
      'Propeller-shaft overall geometry, flange interface, bolt pattern and construction criteria.',
    targetProductTypeCodes: ['PROPELLER_SHAFT'],
    items: [
      requiredComparable('ATTR_DRIVE_SHAFT_LENGTH', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DRIVE_SHAFT_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PROP_SHAFT_FLANGE_DIAMETER', 30),
      optionalComparable('ATTR_PROP_SHAFT_BOLT_CIRCLE_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PROP_SHAFT_BOLT_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_UNIVERSAL_JOINT_TYPE', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_UNIVERSAL_JOINT_V1',
    name: 'Universal Joint Standard Criteria',
    description:
      'Universal-joint series, cap diameters, cross lengths, retaining style, greaseability and hardware criteria.',
    targetProductTypeCodes: ['UNIVERSAL_JOINT'],
    items: [
      requiredComparable('ATTR_UNIVERSAL_JOINT_TYPE', 10),
      optionalComparable('ATTR_UJ_SERIES', 20),
      requiredComparable('ATTR_UJ_CAP_DIAMETER_A', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_UJ_CAP_DIAMETER_B', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_UJ_LENGTH_A', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_UJ_LENGTH_B', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_UJ_GREASEABLE', 70),
      optionalComparable('ATTR_UJ_GREASE_FITTING_LOCATION', 80),
      optionalComparable('ATTR_SNAP_RING_INCLUDED', 90),
      optionalComparable('ATTR_SNAP_RING_TYPE', 100),
      requiredComparable('ATTR_MATERIAL', 110),
    ],
  },
  {
    code: 'CANON_CENTER_SUPPORT_BEARING_V1',
    name: 'Propeller Shaft Center Support Bearing Standard Criteria',
    description:
      'Driveshaft center-support bearing bore, outside diameter, width, centerline height and mounting-hole spacing criteria.',
    targetProductTypeCodes: ['CENTER_SUPPORT_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CENTER_SUPPORT_HEIGHT', 50),
      optionalComparable('ATTR_CENTER_SUPPORT_BOLT_HOLE_CENTER', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_FLEX_DISC_V1',
    name: 'Propeller Shaft Flex Disc Standard Criteria',
    description:
      'Flexible coupling disc diameter, thickness, bolt geometry and material criteria.',
    targetProductTypeCodes: ['FLEX_DISC'],
    items: [
      requiredComparable('ATTR_FLEX_DISC_OUTSIDE_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLEX_DISC_THICKNESS', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BOLT_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BOLT_CIRCLE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
    ],
  },
  {
    code: 'CANON_DIFFERENTIAL_ASSEMBLY_V1',
    name: 'Differential Assembly Standard Criteria',
    description:
      'Differential architecture, final-drive ratio, ring/pinion geometry and carrier spline criteria.',
    targetProductTypeCodes: ['DIFFERENTIAL_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_DIFFERENTIAL_TYPE', 10),
      requiredComparable('ATTR_GEAR_RATIO', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DIFFERENTIAL_RING_GEAR_TOOTH_COUNT', 30),
      optionalComparable('ATTR_DIFFERENTIAL_PINION_TOOTH_COUNT', 40),
      optionalComparable('ATTR_DIFFERENTIAL_RING_GEAR_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DIFFERENTIAL_CARRIER_SPLINE_COUNT', 60),
      optionalComparable('ATTR_TRANSMISSION_FLUID_SPEC', 70),
    ],
  },
  {
    code: 'CANON_DIFFERENTIAL_BEARING_V1',
    name: 'Differential Bearing Standard Criteria',
    description:
      'Differential bearing type, bore, outside diameter and width criteria.',
    targetProductTypeCodes: ['DIFFERENTIAL_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_TYPE', 50),
    ],
  },
  {
    code: 'CANON_DIFFERENTIAL_SEAL_V1',
    name: 'Differential Seal Standard Criteria',
    description:
      'Differential shaft/pinion seal type, material and dimensional criteria.',
    targetProductTypeCodes: ['DIFFERENTIAL_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 50, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_AXLE_SHAFT_V1',
    name: 'Axle Shaft Standard Criteria',
    description:
      'Axle-shaft position, side, length, diameter and differential/hub spline criteria.',
    targetProductTypeCodes: ['AXLE_SHAFT'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      requiredComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_AXLE_SHAFT_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AXLE_SHAFT_DIAMETER', 40),
      requiredComparable('ATTR_AXLE_SHAFT_INNER_SPLINE_COUNT', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AXLE_SHAFT_OUTER_SPLINE_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_SIZE', 70),
      optionalComparable('ATTR_THREAD_PITCH', 80),
    ],
  },
  {
    code: 'CANON_AXLE_SEAL_V1',
    name: 'Axle Shaft Seal Standard Criteria',
    description:
      'Axle-shaft seal type, material and dimensional criteria.',
    targetProductTypeCodes: ['AXLE_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 50, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_AXLE_BEARING_V1',
    name: 'Axle Bearing Standard Criteria',
    description:
      'Axle bearing type, bore, outside diameter, width and sealing criteria.',
    targetProductTypeCodes: ['AXLE_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_TYPE', 50),
    ],
  },
  {
    code: 'CANON_TRANSFER_CASE_V1',
    name: 'Transfer Case Standard Criteria',
    description:
      'Transfer-case architecture, selectable ranges, ratio and lubricant criteria.',
    targetProductTypeCodes: ['TRANSFER_CASE'],
    items: [
      requiredComparable('ATTR_TRANSFER_CASE_TYPE', 10),
      optionalComparable('ATTR_TRANSFER_CASE_SPEED_COUNT', 20),
      optionalComparable('ATTR_GEAR_RATIO', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TRANSMISSION_FLUID_SPEC', 40),
      optionalComparable('ATTR_PORT_COUNT', 50),
    ],
  },
  {
    code: 'CANON_TRANSFER_CASE_MOTOR_V1',
    name: 'Transfer Case Motor Standard Criteria',
    description:
      'Transfer-case actuator/motor electrical, stroke, connector and mounting criteria.',
    targetProductTypeCodes: ['TRANSFER_CASE_MOTOR'],
    items: [
      requiredComparable('ATTR_ACTUATOR_TYPE', 10),
      optionalComparable('ATTR_ACTUATOR_STROKE', 20),
      requiredComparable('ATTR_VOLTAGE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CURRENT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_TRANSFER_CASE_CHAIN_V1',
    name: 'Transfer Case Chain Standard Criteria',
    description:
      'Transfer-case drive-chain link count, width, pitch and material criteria.',
    targetProductTypeCodes: ['TRANSFER_CASE_CHAIN'],
    items: [
      requiredComparable('ATTR_TRANSFER_CASE_CHAIN_LINK_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSFER_CASE_CHAIN_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSFER_CASE_CHAIN_PITCH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_TRANSFER_CASE_SEAL_V1',
    name: 'Transfer Case Seal Standard Criteria',
    description:
      'Transfer-case shaft/output seal type, material and dimensional criteria.',
    targetProductTypeCodes: ['TRANSFER_CASE_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 50, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_FRONT_AXLE_ACTUATOR_V1',
    name: 'Front Axle Actuator Standard Criteria',
    description:
      'Front-axle engagement actuator architecture, electrical, travel, connector and mounting criteria.',
    targetProductTypeCodes: ['FRONT_AXLE_ACTUATOR'],
    items: [
      requiredComparable('ATTR_AXLE_ACTUATOR_TYPE', 10),
      optionalComparable('ATTR_ACTUATOR_STROKE', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_CLUTCH_KIT_V1',
    name: 'Clutch Kit Standard Criteria',
    description:
      'Complete clutch kit geometry, spline, friction and package-content criteria. Exact vehicle/transmission compatibility remains structured fitment.',
    targetProductTypeCodes: ['CLUTCH_KIT'],
    items: [
      requiredComparable('ATTR_CLUTCH_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CLUTCH_SPLINE_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_INPUT_SHAFT_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUTCH_FRICTION_MATERIAL', 40),
      optionalComparable('ATTR_CLUTCH_DISC_SPRUNG_HUB', 50),
      optionalComparable('ATTR_PRESSURE_PLATE_TYPE', 60),
      optionalComparable('ATTR_FLYWHEEL_TOOTH_COUNT', 70),
      optionalComparable('ATTR_TRANSMISSION_TYPE', 80),
    ],
  },
  {
    code: 'CANON_CLUTCH_DISC_V1',
    name: 'Clutch Disc Standard Criteria',
    description:
      'Clutch disc diameter, thickness, hub/spline, friction material and torsional-damper criteria.',
    targetProductTypeCodes: ['CLUTCH_DISC'],
    items: [
      requiredComparable('ATTR_CLUTCH_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CLUTCH_DISC_THICKNESS', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CLUTCH_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_INPUT_SHAFT_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUTCH_HUB_DIAMETER', 50),
      requiredComparable('ATTR_CLUTCH_FRICTION_MATERIAL', 60),
      optionalComparable('ATTR_CLUTCH_DISC_SPRUNG_HUB', 70),
      optionalComparable('ATTR_CLUTCH_DAMPER_SPRING_COUNT', 80),
    ],
  },
  {
    code: 'CANON_CLUTCH_PRESSURE_PLATE_V1',
    name: 'Clutch Pressure Plate Standard Criteria',
    description:
      'Clutch cover/pressure plate diameter, construction, installed height, clamp load and bolt-pattern criteria.',
    targetProductTypeCodes: ['CLUTCH_PRESSURE_PLATE'],
    items: [
      requiredComparable('ATTR_CLUTCH_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PRESSURE_PLATE_TYPE', 20),
      optionalComparable('ATTR_PRESSURE_PLATE_HEIGHT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUTCH_CLAMP_LOAD', 40),
      optionalComparable('ATTR_BOLT_COUNT', 50),
      optionalComparable('ATTR_BOLT_CIRCLE_DIAMETER', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_RELEASE_BEARING_V1',
    name: 'Clutch Release Bearing Standard Criteria',
    description:
      'Clutch release-bearing bore, outside diameter, width and fork-interface geometry criteria.',
    targetProductTypeCodes: ['RELEASE_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BEARING_WIDTH', 40),
      optionalComparable('ATTR_RELEASE_BEARING_OVERALL_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_RELEASE_BEARING_FORK_GROOVE_WIDTH', 60),
      optionalComparable('ATTR_RELEASE_BEARING_FORK_GROOVE_DIAMETER', 70),
      optionalComparable('ATTR_RELEASE_BEARING_FORK_TO_FACE', 80),
    ],
  },
  {
    code: 'CANON_CLUTCH_MASTER_CYLINDER_V1',
    name: 'Clutch Master Cylinder Standard Criteria',
    description:
      'Clutch master-cylinder hydraulic bore, stroke, pushrod, ports, thread and reservoir criteria.',
    targetProductTypeCodes: ['CLUTCH_MASTER_CYLINDER'],
    items: [
      requiredComparable('ATTR_CLUTCH_CYLINDER_BORE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUTCH_CYLINDER_STROKE', 20),
      optionalComparable('ATTR_CLUTCH_PUSHROD_LENGTH', 30),
      optionalComparable('ATTR_PORT_COUNT', 40),
      optionalComparable('ATTR_THREAD_SIZE', 50),
      optionalComparable('ATTR_CLUTCH_RESERVOIR_INCLUDED', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_CLUTCH_SLAVE_CYLINDER_V1',
    name: 'Clutch Slave Cylinder Standard Criteria',
    description:
      'Clutch slave-cylinder hydraulic bore, stroke, pushrod, ports and mounting criteria.',
    targetProductTypeCodes: ['CLUTCH_SLAVE_CYLINDER'],
    items: [
      requiredComparable('ATTR_CLUTCH_CYLINDER_BORE', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUTCH_CYLINDER_STROKE', 20),
      optionalComparable('ATTR_CLUTCH_PUSHROD_LENGTH', 30),
      optionalComparable('ATTR_PORT_COUNT', 40),
      optionalComparable('ATTR_THREAD_SIZE', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_DUAL_MASS_FLYWHEEL_V1',
    name: 'Dual-Mass Flywheel Standard Criteria',
    description:
      'Dual-mass flywheel size, ring gear, bolt geometry, friction surface and free-play criteria.',
    targetProductTypeCodes: ['DUAL_MASS_FLYWHEEL'],
    items: [
      requiredComparable('ATTR_DUAL_MASS_FLYWHEEL_TYPE', 10),
      requiredComparable('ATTR_FLYWHEEL_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLYWHEEL_TOOTH_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLYWHEEL_THICKNESS', 40),
      optionalComparable('ATTR_FLYWHEEL_FRICTION_SURFACE_DIAMETER', 50),
      requiredComparable('ATTR_FLYWHEEL_BOLT_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLYWHEEL_BOLT_CIRCLE_DIAMETER', 70),
      optionalComparable('ATTR_DUAL_MASS_FREE_PLAY_ANGLE', 80),
      optionalComparable('ATTR_DUAL_MASS_AXIAL_PLAY', 90),
      optionalComparable('ATTR_ITEM_WEIGHT', 100),
    ],
  },
  {
    code: 'CANON_FLYWHEEL_V1',
    name: 'Flywheel Standard Criteria',
    description:
      'Rigid flywheel diameter, ring-gear teeth, bolt pattern, friction surface and mass criteria.',
    targetProductTypeCodes: ['FLYWHEEL'],
    items: [
      requiredComparable('ATTR_FLYWHEEL_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLYWHEEL_TOOTH_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLYWHEEL_THICKNESS', 30),
      optionalComparable('ATTR_FLYWHEEL_FRICTION_SURFACE_DIAMETER', 40),
      requiredComparable('ATTR_FLYWHEEL_BOLT_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLYWHEEL_BOLT_CIRCLE_DIAMETER', 60),
      optionalComparable('ATTR_ITEM_WEIGHT', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_PILOT_BEARING_V1',
    name: 'Clutch Pilot Bearing Standard Criteria',
    description:
      'Pilot bearing type, bore, outside diameter, width and sealing criteria.',
    targetProductTypeCodes: ['PILOT_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_TYPE', 50),
    ],
  },
  {
    code: 'CANON_SYNCHRONIZER_RING_V1',
    name: 'Synchronizer Ring Standard Criteria',
    description:
      'Manual-transmission synchronizer ring position, geometry and material criteria.',
    targetProductTypeCodes: ['SYNCHRONIZER_RING'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_GEAR_POSITION', 10),
      requiredComparable('ATTR_SYNCHRONIZER_RING_OUTSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SYNCHRONIZER_RING_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SYNCHRONIZER_RING_WIDTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_BEARING_V1',
    name: 'Transmission Bearing Standard Criteria',
    description:
      'Transmission bearing type, bore, outside diameter, width and sealing criteria.',
    targetProductTypeCodes: ['TRANSMISSION_BEARING'],
    items: [
      requiredComparable('ATTR_BEARING_TYPE', 10),
      requiredComparable('ATTR_BEARING_BORE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_TYPE', 50),
    ],
  },
  {
    code: 'CANON_MANUAL_TRANSMISSION_MOUNT_V1',
    name: 'Manual Transmission Mount Standard Criteria',
    description:
      'Transmission mount geometry, bushing material and mounting-hole criteria.',
    targetProductTypeCodes: ['MANUAL_TRANSMISSION_MOUNT'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_BUSHING_MATERIAL', 20),
      optionalComparable('ATTR_LENGTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 50, { variantDefining: true }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_STUD_COUNT', 70),
    ],
  },
  {
    code: 'CANON_GEAR_SHIFT_CABLE_V1',
    name: 'Gear Shift Cable Standard Criteria',
    description:
      'Gear-selector cable function, overall length and end-fitting criteria.',
    targetProductTypeCodes: ['GEAR_SHIFT_CABLE'],
    items: [
      requiredComparable('ATTR_SHIFT_CABLE_TYPE', 10),
      requiredComparable('ATTR_CABLE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHIFT_CABLE_END_TYPE_1', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHIFT_CABLE_END_TYPE_2', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_GEAR_SHIFT_LINKAGE_V1',
    name: 'Gear Shift Linkage Standard Criteria',
    description:
      'Gear-shift linkage length, joint count, thread and material criteria.',
    targetProductTypeCodes: ['GEAR_SHIFT_LINKAGE'],
    items: [
      requiredComparable('ATTR_SHIFT_LINKAGE_LENGTH', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SHIFT_LINKAGE_JOINT_COUNT', 20),
      optionalComparable('ATTR_THREAD_SIZE', 30),
      optionalComparable('ATTR_THREAD_PITCH', 40),
      requiredComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_SHIFT_FORK_V1',
    name: 'Shift Fork Standard Criteria',
    description:
      'Manual-transmission shift-fork gear position, fork width, rail bore and material criteria.',
    targetProductTypeCodes: ['SHIFT_FORK'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_GEAR_POSITION', 10),
      requiredComparable('ATTR_SHIFT_FORK_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SHIFT_FORK_BORE', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_OIL_PAN_V1',
    name: 'Transmission Oil Pan Standard Criteria',
    description:
      'Transmission pan capacity, physical dimensions, material, gasket and magnet criteria.',
    targetProductTypeCodes: ['TRANSMISSION_OIL_PAN'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_TYPE', 10),
      optionalComparable('ATTR_TRANSMISSION_PAN_CAPACITY', 20),
      requiredComparable('ATTR_TRANSMISSION_PAN_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSMISSION_PAN_WIDTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSMISSION_PAN_DEPTH', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_TRANSMISSION_PAN_GASKET_INCLUDED', 70),
      optionalComparable('ATTR_TRANSMISSION_PAN_MAGNET_INCLUDED', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_SOLENOID_V1',
    name: 'Transmission Solenoid Standard Criteria',
    description:
      'Automatic-transmission solenoid type, hydraulic function, coil resistance, physical identification and connector criteria.',
    targetProductTypeCodes: ['TRANSMISSION_SOLENOID'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_TYPE', 10),
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_FUNCTION', 20),
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_RESISTANCE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TRANSMISSION_SOLENOID_DIAMETER', 40),
      optionalComparable('ATTR_TRANSMISSION_SOLENOID_SLOT_COUNT', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
    ],
  },
  {
    code: 'CANON_TORQUE_CONVERTER_V1',
    name: 'Torque Converter Standard Criteria',
    description:
      'Torque-converter diameter, pilot, spline, stall-speed, lockup and flexplate mounting criteria.',
    targetProductTypeCodes: ['TORQUE_CONVERTER'],
    items: [
      requiredComparable('ATTR_TORQUE_CONVERTER_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TORQUE_CONVERTER_PILOT_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TORQUE_CONVERTER_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TORQUE_CONVERTER_STALL_SPEED', 40),
      optionalComparable('ATTR_TORQUE_CONVERTER_LOCKUP', 50),
      requiredComparable('ATTR_TORQUE_CONVERTER_MOUNT_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TORQUE_CONVERTER_BOLT_CIRCLE_DIAMETER', 70),
      optionalComparable('ATTR_ITEM_WEIGHT', 80),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_VALVE_BODY_V1',
    name: 'Transmission Valve Body Standard Criteria',
    description:
      'Automatic-transmission valve body transmission family, solenoid/circuit count, connector and material criteria.',
    targetProductTypeCodes: ['VALVE_BODY'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_TYPE', 10),
      optionalComparable('ATTR_VALVE_BODY_SOLENOID_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VALVE_BODY_CHANNEL_COUNT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_CONTROL_MODULE_V1',
    name: 'Transmission Control Module Standard Criteria',
    description:
      'Transmission controller voltage, connectors, protocol, programming and mounting criteria.',
    targetProductTypeCodes: ['TRANSMISSION_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20),
      requiredComparable('ATTR_CONNECTOR_COUNT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 50),
      optionalComparable('ATTR_PROGRAMMABLE', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_COOLER_V1',
    name: 'Transmission Oil Cooler Standard Criteria',
    description:
      'Transmission oil cooler core geometry, fluid connections, material and pressure criteria.',
    targetProductTypeCodes: ['TRANSMISSION_COOLER'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_COOLER_CORE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSMISSION_COOLER_CORE_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSMISSION_COOLER_CORE_THICKNESS', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TRANSMISSION_COOLER_INLET_DIAMETER', 40),
      requiredComparable('ATTR_TRANSMISSION_COOLER_OUTLET_DIAMETER', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 70),
      optionalComparable('ATTR_TRANSMISSION_FLUID_SPEC', 80),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_RANGE_SENSOR_V1',
    name: 'Transmission Range Sensor Standard Criteria',
    description:
      'Transmission range/selector sensor technology, position count, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['TRANSMISSION_RANGE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_GEAR_SELECTOR_POSITION_COUNT', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_TRANSMISSION_SPEED_SENSOR_V1',
    name: 'Transmission Speed Sensor Standard Criteria',
    description:
      'Transmission speed sensor technology, signal, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['TRANSMISSION_SPEED_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_RESISTANCE', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_GEAR_SELECTOR_ASSEMBLY_V1',
    name: 'Gear Selector Assembly Standard Criteria',
    description:
      'Gear-selector architecture, selectable positions, circuits, connector and communication criteria.',
    targetProductTypeCodes: ['GEAR_SELECTOR_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_GEAR_SELECTOR_TYPE', 10),
      requiredComparable('ATTR_GEAR_SELECTOR_POSITION_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_CONNECTOR_COUNT', 40),
      optionalComparable('ATTR_PIN_COUNT', 50),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 60),
    ],
  },
  {
    code: 'CANON_SHIFT_SOLENOID_V1',
    name: 'Shift Solenoid Standard Criteria',
    description:
      'Transmission shift-solenoid type, hydraulic function, resistance, identifying geometry and electrical interface criteria.',
    targetProductTypeCodes: ['SHIFT_SOLENOID'],
    items: [
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_TYPE', 10),
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_FUNCTION', 20),
      requiredComparable('ATTR_TRANSMISSION_SOLENOID_RESISTANCE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TRANSMISSION_SOLENOID_DIAMETER', 40),
      optionalComparable('ATTR_TRANSMISSION_SOLENOID_SLOT_COUNT', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
    ],
  },
  {
    code: 'CANON_SERPENTINE_BELT_V1',
    name: 'Serpentine / Multi-Rib Belt Standard Criteria',
    description:
      'Accessory multi-rib belt effective length, outside circumference, rib count, profile, width and material criteria.',
    targetProductTypeCodes: ['SERPENTINE_BELT'],
    items: [
      requiredComparable('ATTR_BELT_TYPE', 10),
      requiredComparable('ATTR_BELT_EFFECTIVE_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BELT_OUTSIDE_CIRCUMFERENCE', 30),
      requiredComparable('ATTR_BELT_RIB_COUNT', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_SECTION', 50),
      requiredComparable('ATTR_BELT_TOP_WIDTH', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_V_BELT_V1',
    name: 'V-Belt Standard Criteria',
    description:
      'Accessory V-belt effective length, outside circumference, section, top width and material criteria.',
    targetProductTypeCodes: ['V_BELT'],
    items: [
      requiredComparable('ATTR_BELT_TYPE', 10),
      requiredComparable('ATTR_BELT_EFFECTIVE_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BELT_OUTSIDE_CIRCUMFERENCE', 30),
      requiredComparable('ATTR_BELT_SECTION', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_TOP_WIDTH', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_BELT_TENSIONER_V1',
    name: 'Accessory Belt Tensioner Standard Criteria',
    description:
      'Accessory belt tensioner construction, pulley geometry, contact surface, rib count, damping and mounting criteria.',
    targetProductTypeCodes: ['BELT_TENSIONER'],
    items: [
      requiredComparable('ATTR_TENSIONER_TYPE', 10),
      requiredComparable('ATTR_TENSIONER_PULLEY_CONTACT_SURFACE', 20),
      requiredComparable('ATTR_TENSIONER_PULLEY_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TENSIONER_PULLEY_BORE', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TENSIONER_PULLEY_WIDTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TENSIONER_PULLEY_COUNT', 60),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 70),
      optionalComparable('ATTR_TENSIONER_ARM_LENGTH', 80),
      optionalComparable('ATTR_TENSIONER_DAMPING_TYPE', 90),
      optionalComparable('ATTR_PULLEY_FLANGED', 100),
      optionalComparable('ATTR_PULLEY_BEARING_INCLUDED', 110),
      optionalComparable('ATTR_MATERIAL', 120),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 130),
    ],
  },
  {
    code: 'CANON_BELT_PULLEY_V1',
    name: 'Accessory Idler / Tensioner Pulley Standard Criteria',
    description:
      'Accessory idler and replacement tensioner pulley contact surface, diameter, bore, width, grooves, flange, bearing and material criteria.',
    targetProductTypeCodes: ['IDLER_PULLEY', 'TENSIONER_PULLEY'],
    items: [
      requiredComparable('ATTR_PULLEY_CONTACT_SURFACE', 10),
      requiredComparable('ATTR_PULLEY_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PULLEY_BORE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PULLEY_WIDTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 50),
      optionalComparable('ATTR_PULLEY_FLANGED', 60),
      optionalComparable('ATTR_PULLEY_BEARING_INCLUDED', 70),
      requiredComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_OVERRUNNING_ALTERNATOR_PULLEY_V1',
    name: 'Overrunning Alternator Pulley Standard Criteria',
    description:
      'Alternator freewheel/decoupler pulley construction, geometry, grooves, thread and rotation criteria.',
    targetProductTypeCodes: ['OVERRUNNING_ALTERNATOR_PULLEY'],
    items: [
      requiredComparable('ATTR_OVERRUNNING_PULLEY_TYPE', 10),
      requiredComparable('ATTR_PULLEY_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PULLEY_WIDTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_BORE_DIAMETER', 40),
      requiredComparable('ATTR_PULLEY_RIB_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_CONTACT_SURFACE', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 80),
      optionalComparable('ATTR_ROTATION_DIRECTION', 90),
      optionalComparable('ATTR_MATERIAL', 100),
    ],
  },
  {
    code: 'CANON_TIMING_BELT_V1',
    name: 'Timing Belt Standard Criteria',
    description:
      'Synchronous timing belt tooth count, pitch, pitch length, width, tooth profile and material criteria.',
    targetProductTypeCodes: ['TIMING_BELT'],
    items: [
      requiredComparable('ATTR_BELT_TYPE', 10),
      requiredComparable('ATTR_BELT_TOOTH_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_PITCH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_EFFECTIVE_LENGTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_WIDTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIMING_BELT_TOOTH_PROFILE', 60),
      requiredComparable('ATTR_BELT_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_TIMING_BELT_KIT_V1',
    name: 'Timing Belt Kit Standard Criteria',
    description:
      'Timing belt kit primary belt geometry plus included tensioner, idler, water-pump and package-content criteria.',
    targetProductTypeCodes: ['TIMING_BELT_KIT'],
    items: [
      requiredComparable('ATTR_BELT_TOOTH_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BELT_WIDTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BELT_EFFECTIVE_LENGTH', 40),
      optionalComparable('ATTR_TIMING_TENSIONER_INCLUDED', 50),
      optionalComparable('ATTR_TIMING_IDLER_INCLUDED', 60),
      optionalComparable('ATTR_WATER_PUMP_INCLUDED', 70),
    ],
  },
  {
    code: 'CANON_TIMING_CHAIN_V1',
    name: 'Timing Chain Standard Criteria',
    description:
      'Timing-chain construction, link count, row count, pitch, width and material criteria.',
    targetProductTypeCodes: ['TIMING_CHAIN'],
    items: [
      requiredComparable('ATTR_TIMING_CHAIN_TYPE', 10),
      requiredComparable('ATTR_TIMING_CHAIN_LINK_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIMING_CHAIN_ROW_COUNT', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIMING_CHAIN_PITCH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIMING_CHAIN_WIDTH', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_TIMING_CHAIN_KIT_V1',
    name: 'Timing Chain Kit Standard Criteria',
    description:
      'Timing-chain kit primary chain geometry plus included tensioner, guides and package-content criteria.',
    targetProductTypeCodes: ['TIMING_CHAIN_KIT'],
    items: [
      requiredComparable('ATTR_TIMING_CHAIN_TYPE', 10),
      requiredComparable('ATTR_TIMING_CHAIN_LINK_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIMING_CHAIN_ROW_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIMING_CHAIN_PITCH', 40),
      optionalComparable('ATTR_TIMING_TENSIONER_INCLUDED', 50),
      optionalComparable('ATTR_TIMING_GUIDE_INCLUDED', 60),
    ],
  },
  {
    code: 'CANON_TIMING_TENSIONER_V1',
    name: 'Timing Tensioner Standard Criteria',
    description:
      'Timing tensioner construction, hydraulic actuation, stroke, pulley/interface and mounting criteria.',
    targetProductTypeCodes: ['TIMING_TENSIONER'],
    items: [
      requiredComparable('ATTR_TIMING_TENSIONER_TYPE', 10),
      optionalComparable('ATTR_TIMING_TENSIONER_HYDRAULIC', 20),
      optionalComparable('ATTR_TIMING_TENSIONER_STROKE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TENSIONER_PULLEY_DIAMETER', 40),
      optionalComparable('ATTR_TENSIONER_PULLEY_BORE', 50),
      optionalComparable('ATTR_TENSIONER_PULLEY_WIDTH', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_MATERIAL', 80),
    ],
  },
  {
    code: 'CANON_TIMING_GUIDE_V1',
    name: 'Timing Chain Guide Standard Criteria',
    description:
      'Timing-chain guide/rail position, length, width, material and mounting criteria.',
    targetProductTypeCodes: ['TIMING_GUIDE'],
    items: [
      optionalComparable('ATTR_POSITION', 10),
      requiredComparable('ATTR_TIMING_GUIDE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIMING_GUIDE_WIDTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 50),
    ],
  },
  {
    code: 'CANON_CAMSHAFT_GEAR_V1',
    name: 'Camshaft Gear / Sprocket Standard Criteria',
    description:
      'Camshaft timing sprocket tooth count, geometry, chain rows, keyways, material and optional variable-timing architecture.',
    targetProductTypeCodes: ['CAMSHAFT_GEAR'],
    items: [
      requiredComparable('ATTR_SPROCKET_TOOTH_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPROCKET_OUTSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPROCKET_BORE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPROCKET_CHAIN_ROW_COUNT', 40),
      optionalComparable('ATTR_SPROCKET_KEYWAY_COUNT', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_CAM_ADJUSTER_TYPE', 70),
      optionalComparable('ATTR_CAM_ADJUSTER_RANGE', 80),
    ],
  },
  {
    code: 'CANON_CRANKSHAFT_GEAR_V1',
    name: 'Crankshaft Gear / Sprocket Standard Criteria',
    description:
      'Crankshaft timing sprocket tooth count, geometry, chain rows, keyways and material criteria.',
    targetProductTypeCodes: ['CRANKSHAFT_GEAR'],
    items: [
      requiredComparable('ATTR_SPROCKET_TOOTH_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPROCKET_OUTSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SPROCKET_BORE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SPROCKET_CHAIN_ROW_COUNT', 40),
      optionalComparable('ATTR_SPROCKET_KEYWAY_COUNT', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_SIDE_MIRROR_ASSEMBLY_V1',
    name: 'Side Mirror Assembly Standard Criteria',
    description:
      'Complete exterior mirror side, optical/electrical functions, adjustment, folding, signaling and connector criteria.',
    targetProductTypeCodes: ['SIDE_MIRROR_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_MIRROR_TYPE', 20),
      optionalComparable('ATTR_MIRROR_HEATED', 30),
      optionalComparable('ATTR_MIRROR_POWER_ADJUSTABLE', 40),
      optionalComparable('ATTR_MIRROR_FOLDING', 50),
      optionalComparable('ATTR_MIRROR_AUTO_DIMMING', 60),
      optionalComparable('ATTR_MIRROR_MEMORY', 70),
      optionalComparable('ATTR_MIRROR_TURN_SIGNAL', 80),
      optionalComparable('ATTR_MIRROR_BLIND_SPOT_INDICATOR', 90),
      optionalComparable('ATTR_MIRROR_PUDDLE_LIGHT', 100),
      optionalComparable('ATTR_VOLTAGE', 110),
      optionalComparable('ATTR_CONNECTOR_COUNT', 120),
      optionalComparable('ATTR_PIN_COUNT', 130),
      optionalComparable('ATTR_PAINTED', 140),
      optionalComparable('ATTR_COLOR', 150),
    ],
  },
  {
    code: 'CANON_MIRROR_GLASS_V1',
    name: 'Mirror Glass Standard Criteria',
    description:
      'Replacement mirror-glass side, optical shape, dimensions, heating, dimming and blind-spot criteria.',
    targetProductTypeCodes: ['MIRROR_GLASS'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_MIRROR_GLASS_SHAPE', 20, { variantDefining: true }),
      optionalComparable('ATTR_MIRROR_GLASS_WIDTH', 30, { variantDefining: true }),
      optionalComparable('ATTR_MIRROR_GLASS_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_MIRROR_ASPHERICAL', 50),
      optionalComparable('ATTR_MIRROR_HEATED', 60),
      optionalComparable('ATTR_MIRROR_AUTO_DIMMING', 70),
      optionalComparable('ATTR_MIRROR_BLIND_SPOT_INDICATOR', 80),
      optionalComparable('ATTR_GLASS_TYPE', 90),
    ],
  },
  {
    code: 'CANON_MIRROR_COVER_V1',
    name: 'Mirror Cover Standard Criteria',
    description:
      'Mirror-cap side, material, finish/paint preparation, geometry and mounting criteria.',
    targetProductTypeCodes: ['MIRROR_COVER'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_MATERIAL', 20),
      optionalComparable('ATTR_PRIMED', 30),
      optionalComparable('ATTR_PAINTED', 40),
      optionalComparable('ATTR_COLOR', 50),
      optionalComparable('ATTR_FINISH', 60),
      optionalComparable('ATTR_LENGTH', 70),
      optionalComparable('ATTR_WIDTH', 80),
      optionalComparable('ATTR_HEIGHT', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_MIRROR_MOTOR_V1',
    name: 'Mirror Adjustment Motor Standard Criteria',
    description:
      'Mirror-adjustment motor axis count, electrical rating, connector and mounting criteria.',
    targetProductTypeCodes: ['MIRROR_MOTOR'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_MIRROR_MOTOR_AXIS_COUNT', 20),
      requiredComparable('ATTR_VOLTAGE', 30, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_MIRROR_SWITCH_V1',
    name: 'Mirror Switch Standard Criteria',
    description:
      'Exterior mirror switch positions, circuits, electrical rating and connector criteria.',
    targetProductTypeCodes: ['MIRROR_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_SWITCH_POSITION_COUNT', 20),
      optionalComparable('ATTR_CIRCUIT_COUNT', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_COUNT', 70),
    ],
  },
  {
    code: 'CANON_BUMPER_V1',
    name: 'Front / Rear Bumper Standard Criteria',
    description:
      'Bumper cover material, finish, dimensions and integrated opening/provision criteria.',
    targetProductTypeCodes: ['FRONT_BUMPER', 'REAR_BUMPER'],
    items: [
      requiredComparable('ATTR_MATERIAL', 10),
      optionalComparable('ATTR_PRIMED', 20),
      optionalComparable('ATTR_PAINTED', 30),
      optionalComparable('ATTR_COLOR', 40),
      optionalComparable('ATTR_LENGTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 60, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 70, { variantDefining: true }),
      optionalComparable('ATTR_PARKING_SENSOR_HOLE_COUNT', 80),
      optionalComparable('ATTR_CAMERA_OPENING', 90),
      optionalComparable('ATTR_FOG_LAMP_OPENING', 100),
      optionalComparable('ATTR_TOW_EYE_COVER_INCLUDED', 110),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 120),
    ],
  },
  {
    code: 'CANON_BODY_PANEL_V1',
    name: 'Body Panel Standard Criteria',
    description:
      'Exterior structural/cosmetic panel material, side, finish, geometry and mounting/provision criteria.',
    targetProductTypeCodes: [
      'FENDER',
      'HOOD',
      'DOOR_SHELL',
      'TAILGATE',
      'GRILLE',
      'ROCKER_PANEL',
    ],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_MATERIAL', 20),
      optionalComparable('ATTR_PRIMED', 30),
      optionalComparable('ATTR_PAINTED', 40),
      optionalComparable('ATTR_COLOR', 50),
      optionalComparable('ATTR_FINISH', 60),
      optionalComparable('ATTR_LENGTH', 70, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 80, { variantDefining: true }),
      optionalComparable('ATTR_HEIGHT', 90, { variantDefining: true }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
      optionalComparable('ATTR_PARKING_SENSOR_HOLE_COUNT', 110),
      optionalComparable('ATTR_WASHER_NOZZLE_HOLE_COUNT', 120),
      optionalComparable('ATTR_CAMERA_OPENING', 130),
    ],
  },
  {
    code: 'CANON_WINDSHIELD_V1',
    name: 'Windshield Standard Criteria',
    description:
      'Windshield construction, geometry, optical/comfort technologies, ADAS/HUD and sensor provisions.',
    targetProductTypeCodes: ['WINDSHIELD'],
    items: [
      requiredComparable('ATTR_GLASS_CONSTRUCTION', 10),
      requiredComparable('ATTR_GLASS_WIDTH', 20, { variantDefining: true }),
      requiredComparable('ATTR_GLASS_HEIGHT', 30, { variantDefining: true }),
      optionalComparable('ATTR_GLASS_THICKNESS', 40),
      optionalComparable('ATTR_GLASS_TINT', 50),
      optionalComparable('ATTR_GLASS_ACOUSTIC', 60),
      optionalComparable('ATTR_GLASS_HEATED', 70),
      optionalComparable('ATTR_GLASS_HUD', 80),
      optionalComparable('ATTR_GLASS_ADAS_CAMERA', 90),
      optionalComparable('ATTR_GLASS_RAIN_SENSOR', 100),
      optionalComparable('ATTR_GLASS_LIGHT_SENSOR', 110),
      optionalComparable('ATTR_GLASS_SOLAR_CONTROL', 120),
      optionalComparable('ATTR_GLASS_UV_CONTROL', 130),
      optionalComparable('ATTR_GLASS_ANTENNA', 140),
      optionalComparable('ATTR_GLASS_MOLDING_INCLUDED', 150),
      criterion('ATTR_E_MARK', 160, { filterable: true }),
    ],
  },
  {
    code: 'CANON_BODY_GLAZING_V1',
    name: 'Side / Rear Automotive Glass Standard Criteria',
    description:
      'Side, rear and quarter glazing construction, geometry, tint, heating/antenna, acoustic and encapsulation criteria.',
    targetProductTypeCodes: [
      'SIDE_WINDOW_GLASS',
      'REAR_WINDOW_GLASS',
      'QUARTER_GLASS',
    ],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_GLASS_CONSTRUCTION', 20),
      requiredComparable('ATTR_GLASS_WIDTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_GLASS_HEIGHT', 40, { variantDefining: true }),
      optionalComparable('ATTR_GLASS_THICKNESS', 50),
      optionalComparable('ATTR_GLASS_TINT', 60),
      optionalComparable('ATTR_GLASS_ACOUSTIC', 70),
      optionalComparable('ATTR_GLASS_HEATED', 80),
      optionalComparable('ATTR_GLASS_DEFROSTER', 90),
      optionalComparable('ATTR_GLASS_ANTENNA', 100),
      optionalComparable('ATTR_GLASS_SOLAR_CONTROL', 110),
      optionalComparable('ATTR_GLASS_UV_CONTROL', 120),
      optionalComparable('ATTR_GLASS_ENCAPSULATED', 130),
      optionalComparable('ATTR_GLASS_MOLDING_INCLUDED', 140),
      criterion('ATTR_E_MARK', 150, { filterable: true }),
    ],
  },
  {
    code: 'CANON_DOOR_HANDLE_V1',
    name: 'Door Handle Standard Criteria',
    description:
      'Door-handle side, construction, material, key/keyless functions, finish and electrical criteria.',
    targetProductTypeCodes: ['DOOR_HANDLE'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_DOOR_HANDLE_TYPE', 20),
      requiredComparable('ATTR_MATERIAL', 30),
      optionalComparable('ATTR_DOOR_HANDLE_KEYHOLE', 40),
      optionalComparable('ATTR_DOOR_HANDLE_KEYLESS_SENSOR', 50),
      optionalComparable('ATTR_PAINTED', 60),
      optionalComparable('ATTR_COLOR', 70),
      optionalComparable('ATTR_FINISH', 80),
      optionalComparable('ATTR_CONNECTOR_COUNT', 90),
      optionalComparable('ATTR_PIN_COUNT', 100),
    ],
  },
  {
    code: 'CANON_DOOR_LOCK_ACTUATOR_V1',
    name: 'Door Lock Actuator Standard Criteria',
    description:
      'Door-lock actuator side, actuation architecture, electrical rating, central-locking and connector criteria.',
    targetProductTypeCodes: ['DOOR_LOCK_ACTUATOR'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_LOCK_ACTUATOR_TYPE', 20),
      optionalComparable('ATTR_CENTRAL_LOCKING', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_CURRENT', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_BODY_LATCH_V1',
    name: 'Body Latch / Lock Standard Criteria',
    description:
      'Door, hood, tailgate and trunk latch material, side, locking/sensor functions, cable and electrical interface criteria.',
    targetProductTypeCodes: [
      'DOOR_LATCH',
      'HOOD_LATCH',
      'TAILGATE_LATCH',
      'TRUNK_LOCK',
    ],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_MATERIAL', 20),
      optionalComparable('ATTR_CENTRAL_LOCKING', 30),
      optionalComparable('ATTR_CHILD_LOCK', 40),
      optionalComparable('ATTR_LATCH_POSITION_SENSOR', 50),
      optionalComparable('ATTR_LATCH_CABLE_INCLUDED', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_CONNECTOR_COUNT', 80),
      optionalComparable('ATTR_PIN_COUNT', 90),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
    ],
  },
  {
    code: 'CANON_BODY_LIFT_SUPPORT_V1',
    name: 'Hood / Trunk / Tailgate Lift Support Standard Criteria',
    description:
      'Automotive gas-spring geometry, force, end fittings and damping criteria.',
    targetProductTypeCodes: ['HOOD_STRUT', 'TRUNK_STRUT', 'TAILGATE_STRUT'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_GAS_SPRING_EXTENDED_LENGTH', 20, { variantDefining: true }),
      requiredComparable('ATTR_GAS_SPRING_COMPRESSED_LENGTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_GAS_SPRING_STROKE', 40),
      optionalComparable('ATTR_GAS_SPRING_TUBE_DIAMETER', 50),
      optionalComparable('ATTR_GAS_SPRING_ROD_DIAMETER', 60),
      requiredComparable('ATTR_GAS_SPRING_EXTENSION_FORCE', 70, { variantDefining: true }),
      requiredComparable('ATTR_GAS_SPRING_ROD_END', 80),
      requiredComparable('ATTR_GAS_SPRING_TUBE_END', 90),
      optionalComparable('ATTR_GAS_SPRING_DAMPING', 100),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 110),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 120),
    ],
  },
  {
    code: 'CANON_WHEEL_V1',
    name: 'Road Wheel Standard Criteria',
    description:
      'Road-wheel diameter, width, bolt pattern, offset, center bore, material and load criteria.',
    targetProductTypeCodes: ['ALLOY_WHEEL', 'STEEL_WHEEL'],
    items: [
      requiredComparable('ATTR_WHEEL_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BOLT_PATTERN', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_OFFSET', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_CENTER_BORE', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_LOAD_RATING', 60),
      requiredComparable('ATTR_WHEEL_MATERIAL', 70),
      optionalComparable('ATTR_FINISH', 80),
      optionalComparable('ATTR_COLOR', 90),
    ],
  },
  {
    code: 'CANON_WHEEL_SPACER_V1',
    name: 'Wheel Spacer / Adapter Standard Criteria',
    description:
      'Wheel spacer thickness, bolt pattern, center bore, attachment architecture, thread and hub-centering criteria.',
    targetProductTypeCodes: ['WHEEL_SPACER'],
    items: [
      requiredComparable('ATTR_WHEEL_SPACER_THICKNESS', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BOLT_PATTERN', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_CENTER_BORE', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_ATTACHMENT_TYPE', 40),
      optionalComparable('ATTR_THREAD_SIZE', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 60),
      requiredComparable('ATTR_WHEEL_SPACER_TYPE', 70),
      optionalComparable('ATTR_HUB_CENTRIC', 80),
      optionalComparable('ATTR_MATERIAL', 90),
      optionalComparable('ATTR_FINISH', 100),
    ],
  },
  {
    code: 'CANON_WHEEL_CENTERING_RING_V1',
    name: 'Wheel Centering Ring Standard Criteria',
    description:
      'Hub-centric centering-ring inner/outer diameters, axial width and material criteria.',
    targetProductTypeCodes: ['WHEEL_CENTERING_RING'],
    items: [
      requiredComparable('ATTR_CENTERING_RING_INNER_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CENTERING_RING_OUTER_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CENTERING_RING_WIDTH', 30),
      requiredComparable('ATTR_MATERIAL', 40),
    ],
  },
  {
    code: 'CANON_WHEEL_COVER_V1',
    name: 'Wheel Cover Standard Criteria',
    description:
      'Wheel-cover nominal wheel size, construction material, finish/color and mounting criteria.',
    targetProductTypeCodes: ['WHEEL_COVER'],
    items: [
      requiredComparable('ATTR_WHEEL_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 20),
      optionalComparable('ATTR_COLOR', 30),
      optionalComparable('ATTR_FINISH', 40),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
    ],
  },
  {
    code: 'CANON_TIRE_V1',
    name: 'Road Tire Standard Criteria',
    description:
      'Passenger, SUV, commercial, all-terrain, mud-terrain and temporary-spare tire size, construction, load, speed and service criteria.',
    targetProductTypeCodes: [
      'PASSENGER_TIRE',
      'SUV_TRUCK_TIRE',
      'COMMERCIAL_TIRE',
      'ALL_TERRAIN_TIRE',
      'MUD_TERRAIN_TIRE',
      'TEMPORARY_SPARE_TIRE',
    ],
    items: [
      requiredComparable('ATTR_TIRE_SECTION_WIDTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_ASPECT_RATIO', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_RIM_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_LOAD_INDEX', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIRE_SECONDARY_LOAD_INDEX', 50),
      requiredComparable('ATTR_TIRE_SPEED_RATING', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_SEASON', 70),
      requiredComparable('ATTR_TIRE_CONSTRUCTION', 80),
      optionalComparable('ATTR_TIRE_LOAD_RANGE', 90),
      optionalComparable('ATTR_TIRE_PLY_RATING', 100),
      optionalComparable('ATTR_TIRE_MAX_LOAD', 110),
      optionalComparable('ATTR_TIRE_OVERALL_DIAMETER', 120),
      optionalComparable('ATTR_TREAD_DEPTH', 130),
      optionalComparable('ATTR_TIRE_TREAD_PATTERN', 140),
      optionalComparable('ATTR_TIRE_SERVICE_TYPE', 150),
      optionalComparable('ATTR_TIRE_TUBE_TYPE', 160),
      optionalComparable('ATTR_TIRE_MAX_PRESSURE', 170),
      optionalComparable('ATTR_RUN_FLAT', 180),
      optionalComparable('ATTR_EXTRA_LOAD', 190),
    ],
  },
  {
    code: 'CANON_TIRE_VALVE_V1',
    name: 'Tire Valve Standard Criteria',
    description:
      'Tire valve construction, stem geometry, wheel-hole interface, pressure, angle and material criteria.',
    targetProductTypeCodes: ['TIRE_VALVE'],
    items: [
      requiredComparable('ATTR_TIRE_VALVE_TYPE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_VALVE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_TIRE_VALVE_RIM_HOLE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIRE_VALVE_MAX_PRESSURE', 40),
      optionalComparable('ATTR_TIRE_VALVE_ANGLE', 50),
      requiredComparable('ATTR_TIRE_VALVE_MATERIAL', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70),
    ],
  },
  {
    code: 'CANON_TPMS_SENSOR_V1',
    name: 'TPMS Sensor Standard Criteria',
    description:
      'Tire-pressure sensor radio frequency, pressure range, valve interface, battery life, programming and environmental criteria.',
    targetProductTypeCodes: ['TPMS_SENSOR'],
    items: [
      requiredComparable('ATTR_TPMS_FREQUENCY', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TPMS_PRESSURE_MIN', 20),
      requiredComparable('ATTR_TPMS_PRESSURE_MAX', 30),
      requiredComparable('ATTR_TIRE_VALVE_TYPE', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_TIRE_VALVE_ANGLE', 50),
      optionalComparable('ATTR_TIRE_VALVE_RIM_HOLE_DIAMETER', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_TPMS_BATTERY_LIFE', 80),
      optionalComparable('ATTR_TPMS_PROGRAMMABLE', 90),
      optionalComparable('ATTR_TPMS_CLONEABLE', 100),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 110),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 120),
      optionalComparable('ATTR_LENGTH', 130),
      optionalComparable('ATTR_WIDTH', 140),
      optionalComparable('ATTR_HEIGHT', 150),
      optionalComparable('ATTR_ITEM_WEIGHT', 160),
    ],
  },
  {
    code: 'CANON_WHEEL_BEARING_V1',
    name: 'Wheel Bearing Standard Criteria',
    description:
      'Bearing construction, geometry and installation-position criteria.',
    targetProductTypeCodes: ['WHEEL_BEARING', 'HUB_BEARING', 'WHEEL_HUB'],
    items: [
      requiredComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_BEARING_TYPE', 30),
      requiredComparable('ATTR_BEARING_BORE', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BEARING_WIDTH', 60, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_WHEEL_HUB_NUT_V1',
    name: 'Wheel Hub Nut Standard Criteria',
    description:
      'Wheel hub/axle nut thread, pitch, hex, height, locking style and material criteria.',
    targetProductTypeCodes: ['WHEEL_HUB_NUT'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AXLE_NUT_HEX_SIZE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AXLE_NUT_HEIGHT', 40),
      requiredComparable('ATTR_AXLE_NUT_STYLE', 50),
      requiredComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_WHEEL_STUD_V1',
    name: 'Wheel Stud Standard Criteria',
    description:
      'Wheel stud thread, overall length, press-fit knurl, head and material criteria.',
    targetProductTypeCodes: ['WHEEL_STUD'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_STUD_OVERALL_LENGTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_STUD_KNURL_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_STUD_KNURL_LENGTH', 50),
      optionalComparable('ATTR_WHEEL_STUD_HEAD_DIAMETER', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_FINISH', 80),
    ],
  },
  {
    code: 'CANON_WHEEL_NUT_V1',
    name: 'Wheel Nut Standard Criteria',
    description:
      'Wheel nut thread, seat geometry, hex, height, open/closed construction, material and finish criteria.',
    targetProductTypeCodes: ['WHEEL_NUT'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_FASTENER_SEAT_TYPE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_FASTENER_SEAT_ANGLE', 40),
      optionalComparable('ATTR_WHEEL_FASTENER_SEAT_RADIUS', 50),
      requiredComparable('ATTR_WHEEL_FASTENER_HEX_SIZE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_NUT_HEIGHT', 70),
      optionalComparable('ATTR_WHEEL_NUT_OPEN_ENDED', 80),
      requiredComparable('ATTR_MATERIAL', 90),
      optionalComparable('ATTR_FINISH', 100),
    ],
  },
  {
    code: 'CANON_WHEEL_BOLT_V1',
    name: 'Wheel Bolt Standard Criteria',
    description:
      'Wheel bolt thread, seat geometry, hex, threaded/overall length, material and finish criteria.',
    targetProductTypeCodes: ['WHEEL_BOLT'],
    items: [
      requiredComparable('ATTR_THREAD_SIZE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_THREAD_PITCH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_FASTENER_SEAT_TYPE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_FASTENER_SEAT_ANGLE', 40),
      optionalComparable('ATTR_WHEEL_FASTENER_SEAT_RADIUS', 50),
      requiredComparable('ATTR_WHEEL_FASTENER_HEX_SIZE', 60, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WHEEL_BOLT_THREAD_LENGTH', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WHEEL_BOLT_OVERALL_LENGTH', 80),
      requiredComparable('ATTR_MATERIAL', 90),
      optionalComparable('ATTR_FINISH', 100),
    ],
  },
  {
    code: 'CANON_HEADLIGHT_ASSEMBLY_V1',
    name: 'Headlight Assembly Standard Criteria',
    description:
      'Complete headlamp optical, electrical, material, environmental and approval criteria. Exact vehicle application remains structured fitment.',
    targetProductTypeCodes: ['HEADLIGHT_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_SIDE', 10, { variantDefining: true }),
      requiredComparable('ATTR_LIGHT_FUNCTION', 20),
      optionalComparable('ATTR_LIGHT_FUNCTION_COUNT', 30),
      requiredComparable('ATTR_BULB_TECHNOLOGY', 40),
      optionalComparable('ATTR_BULB_TYPE', 50),
      optionalComparable('ATTR_LIGHT_SOURCE_COUNT', 60),
      optionalComparable('ATTR_BEAM_PATTERN', 70, { variantDefining: true }),
      optionalComparable('ATTR_TRAFFIC_SIDE', 80, { variantDefining: true }),
      optionalComparable('ATTR_VOLTAGE', 90),
      optionalComparable('ATTR_LIGHT_POWER', 100),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 110),
      optionalComparable('ATTR_LUMINOUS_FLUX', 120),
      optionalComparable('ATTR_HOUSING_MATERIAL', 130),
      optionalComparable('ATTR_LENS_MATERIAL', 140),
      optionalComparable('ATTR_IP_RATING', 150),
      optionalComparable('ATTR_BULB_INCLUDED', 160),
      optionalComparable('ATTR_BALLAST_INCLUDED', 170),
      optionalComparable('ATTR_CONTROL_MODULE_INCLUDED', 180),
      optionalComparable('ATTR_CONNECTOR_GENDER', 190),
      optionalComparable('ATTR_PIN_COUNT', 200),
      optionalComparable('ATTR_MOUNTING_TYPE', 210),
      optionalComparable('ATTR_HEADLIGHT_REFERENCE_NUMBER', 220),
      criterion('ATTR_LIGHTING_APPROVAL', 230, { filterable: true }),
      criterion('ATTR_E_MARK', 240, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 250),
    ],
  },
  {
    code: 'CANON_HEADLIGHT_BULB_V1',
    name: 'Headlight Bulb Standard Criteria',
    description:
      'Replaceable headlamp bulb designation, base, electrical, photometric, physical, lifetime and regulatory criteria.',
    targetProductTypeCodes: ['HEADLIGHT_BULB'],
    items: [
      requiredComparable('ATTR_BULB_TYPE', 10, { variantDefining: true }),
      requiredComparable('ATTR_BULB_TECHNOLOGY', 20),
      requiredComparable('ATTR_LAMP_BASE', 30, { variantDefining: true }),
      requiredComparable('ATTR_VOLTAGE', 40, { variantDefining: true }),
      requiredComparable('ATTR_LIGHT_POWER', 50, { variantDefining: true }),
      optionalComparable('ATTR_TEST_VOLTAGE', 60),
      requiredComparable('ATTR_LUMINOUS_FLUX', 70),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 80),
      optionalComparable('ATTR_LAMP_LENGTH', 90),
      optionalComparable('ATTR_LAMP_DIAMETER', 100),
      optionalComparable('ATTR_LAMP_LIFESPAN_B3', 110),
      optionalComparable('ATTR_LAMP_LIFESPAN_TC', 120),
      optionalComparable('ATTR_ECE_LAMP_CATEGORY', 130),
      criterion('ATTR_LIGHTING_APPROVAL', 140),
      criterion('ATTR_UNECE_REGULATION', 150),
    ],
  },
  {
    code: 'CANON_HID_BALLAST_V1',
    name: 'HID / Xenon Ballast Standard Criteria',
    description:
      'HID ballast type, input/output electrical, connector, enclosure and approval criteria.',
    targetProductTypeCodes: ['HID_BALLAST'],
    items: [
      requiredComparable('ATTR_BALLAST_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_LIGHT_POWER', 40),
      optionalComparable('ATTR_BALLAST_OUTPUT_VOLTAGE', 50),
      requiredComparable('ATTR_CONNECTOR_COUNT', 60),
      optionalComparable('ATTR_PIN_COUNT', 70, { variantDefining: true }),
      optionalComparable('ATTR_LENGTH', 80),
      optionalComparable('ATTR_WIDTH', 90),
      optionalComparable('ATTR_HEIGHT', 100),
      optionalComparable('ATTR_IP_RATING', 110),
      optionalComparable('ATTR_MOUNTING_TYPE', 120),
      criterion('ATTR_LIGHTING_APPROVAL', 130),
    ],
  },
  {
    code: 'CANON_LED_HEADLIGHT_MODULE_V1',
    name: 'LED Headlight Module Standard Criteria',
    description:
      'Integrated LED headlamp module function, electrical, photometric, material, environmental and connector criteria.',
    targetProductTypeCodes: ['LED_HEADLIGHT_MODULE'],
    items: [
      requiredComparable('ATTR_LED_MODULE_TYPE', 10),
      requiredComparable('ATTR_LIGHT_FUNCTION', 20),
      optionalComparable('ATTR_LIGHT_FUNCTION_COUNT', 30),
      requiredComparable('ATTR_VOLTAGE', 40, { variantDefining: true }),
      requiredComparable('ATTR_LIGHT_POWER', 50),
      optionalComparable('ATTR_LUMINOUS_FLUX', 60),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 70),
      optionalComparable('ATTR_HOUSING_MATERIAL', 80),
      optionalComparable('ATTR_LENS_MATERIAL', 90),
      optionalComparable('ATTR_IP_RATING', 100),
      requiredComparable('ATTR_CONNECTOR_GENDER', 110),
      requiredComparable('ATTR_PIN_COUNT', 120, { variantDefining: true }),
      optionalComparable('ATTR_MOUNTING_TYPE', 130),
      criterion('ATTR_LIGHTING_APPROVAL', 140),
      criterion('ATTR_UNECE_REGULATION', 150),
    ],
  },
  {
    code: 'CANON_HEADLIGHT_LEVEL_SENSOR_V1',
    name: 'Headlight Level Sensor Standard Criteria',
    description:
      'Headlamp leveling sensor position, sensing type, arm geometry, angular range and electrical interface criteria.',
    targetProductTypeCodes: ['HEADLIGHT_LEVEL_SENSOR'],
    items: [
      optionalComparable('ATTR_AXLE_POSITION', 10),
      optionalComparable('ATTR_SIDE', 20),
      requiredComparable('ATTR_LEVEL_SENSOR_TYPE', 30),
      optionalComparable('ATTR_LEVEL_SENSOR_ARM_LENGTH', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LEVEL_SENSOR_ANGLE_RANGE', 50),
      optionalComparable('ATTR_SIGNAL_TYPE', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      requiredComparable('ATTR_PIN_COUNT', 80, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_HEADLIGHT_CONTROL_MODULE_V1',
    name: 'Headlight Control Module Standard Criteria',
    description:
      'Headlamp electronic controller voltage/current, connector, communication, coding and environmental criteria.',
    targetProductTypeCodes: ['HEADLIGHT_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      requiredComparable('ATTR_CONNECTOR_COUNT', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, { variantDefining: true }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 50),
      optionalComparable('ATTR_PROGRAMMABLE', 60),
      optionalComparable('ATTR_IP_RATING', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 90),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_EXTERIOR_LAMP_ASSEMBLY_V1',
    name: 'Exterior Signal Lamp Standard Criteria',
    description:
      'Exterior tail, fog, turn, marker, license and daytime-running lamp optical, electrical, material, environmental and approval criteria.',
    targetProductTypeCodes: [
      'TAIL_LIGHT_ASSEMBLY',
      'FOG_LIGHT_ASSEMBLY',
      'TURN_SIGNAL_LAMP',
      'SIDE_MARKER_LAMP',
      'LICENSE_PLATE_LAMP',
      'DAYTIME_RUNNING_LIGHT',
    ],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_LIGHT_FUNCTION', 20),
      optionalComparable('ATTR_LIGHT_FUNCTION_COUNT', 30),
      requiredComparable('ATTR_BULB_TECHNOLOGY', 40),
      optionalComparable('ATTR_BULB_TYPE', 50),
      optionalComparable('ATTR_LIGHT_SOURCE_COUNT', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_LIGHT_POWER', 80),
      optionalComparable('ATTR_LUMINOUS_FLUX', 90),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 100),
      optionalComparable('ATTR_LENS_COLOR', 110),
      optionalComparable('ATTR_HOUSING_COLOR', 120),
      optionalComparable('ATTR_HOUSING_MATERIAL', 130),
      optionalComparable('ATTR_LENS_MATERIAL', 140),
      optionalComparable('ATTR_IP_RATING', 150),
      optionalComparable('ATTR_BULB_INCLUDED', 160),
      optionalComparable('ATTR_CONNECTOR_GENDER', 170),
      optionalComparable('ATTR_PIN_COUNT', 180),
      optionalComparable('ATTR_MOUNTING_TYPE', 190),
      criterion('ATTR_LIGHTING_APPROVAL', 200),
      criterion('ATTR_E_MARK', 210, { filterable: true }),
      criterion('ATTR_UNECE_REGULATION', 220),
    ],
  },
  {
    code: 'CANON_INTERIOR_BULB_V1',
    name: 'Interior Bulb Standard Criteria',
    description:
      'Interior replaceable bulb designation, technology, base, electrical, photometric, physical and lifetime criteria.',
    targetProductTypeCodes: ['INTERIOR_BULB'],
    items: [
      requiredComparable('ATTR_BULB_TYPE', 10, { variantDefining: true }),
      requiredComparable('ATTR_BULB_TECHNOLOGY', 20),
      requiredComparable('ATTR_LAMP_BASE', 30, { variantDefining: true }),
      requiredComparable('ATTR_VOLTAGE', 40, { variantDefining: true }),
      requiredComparable('ATTR_LIGHT_POWER', 50),
      optionalComparable('ATTR_LUMINOUS_FLUX', 60),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 70),
      optionalComparable('ATTR_LAMP_LENGTH', 80),
      optionalComparable('ATTR_LAMP_DIAMETER', 90),
      optionalComparable('ATTR_LAMP_LIFESPAN_B3', 100),
      optionalComparable('ATTR_LAMP_LIFESPAN_TC', 110),
    ],
  },
  {
    code: 'CANON_INTERIOR_LAMP_ASSEMBLY_V1',
    name: 'Interior Lamp Assembly Standard Criteria',
    description:
      'Dome and cargo lamp electrical, light-source, material, connector and mounting criteria.',
    targetProductTypeCodes: ['DOME_LIGHT_ASSEMBLY', 'CARGO_LIGHT_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_LIGHT_FUNCTION', 10),
      requiredComparable('ATTR_BULB_TECHNOLOGY', 20),
      optionalComparable('ATTR_BULB_TYPE', 30),
      optionalComparable('ATTR_LIGHT_SOURCE_COUNT', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_LIGHT_POWER', 60),
      optionalComparable('ATTR_LUMINOUS_FLUX', 70),
      optionalComparable('ATTR_COLOR_TEMPERATURE', 80),
      optionalComparable('ATTR_LENS_COLOR', 90),
      optionalComparable('ATTR_HOUSING_COLOR', 100),
      optionalComparable('ATTR_HOUSING_MATERIAL', 110),
      optionalComparable('ATTR_LENS_MATERIAL', 120),
      optionalComparable('ATTR_BULB_INCLUDED', 130),
      optionalComparable('ATTR_CONNECTOR_GENDER', 140),
      optionalComparable('ATTR_PIN_COUNT', 150),
      optionalComparable('ATTR_MOUNTING_TYPE', 160),
    ],
  },
  {
    code: 'CANON_EXHAUST_MANIFOLD_V1',
    name: 'Exhaust Manifold Standard Criteria',
    description:
      'Exhaust manifold port, outlet, flange, material, heat-shield and sensor-interface criteria.',
    targetProductTypeCodes: ['EXHAUST_MANIFOLD'],
    items: [
      requiredComparable('ATTR_EXHAUST_PORT_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_FLANGE_BOLT_COUNT', 30),
      optionalComparable('ATTR_EXHAUST_FLANGE_BOLT_SPACING', 40),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 50),
      optionalComparable('ATTR_HEAT_SHIELD_INCLUDED', 60),
      optionalComparable('ATTR_OXYGEN_SENSOR_PORT_COUNT', 70),
    ],
  },
  {
    code: 'CANON_EXHAUST_PIPE_V1',
    name: 'Exhaust Pipe Standard Criteria',
    description:
      'Exhaust pipe diameter, length, inlet/outlet connection, material and sensor-port criteria.',
    targetProductTypeCodes: ['EXHAUST_PIPE'],
    items: [
      requiredComparable('ATTR_EXHAUST_PIPE_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OVERALL_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_INLET_TYPE', 30),
      requiredComparable('ATTR_EXHAUST_OUTLET_TYPE', 40),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 50),
      optionalComparable('ATTR_OXYGEN_SENSOR_PORT_COUNT', 60),
      optionalComparable('ATTR_EXHAUST_FLANGE_BOLT_COUNT', 70),
    ],
  },
  {
    code: 'CANON_FLEX_PIPE_V1',
    name: 'Exhaust Flex Pipe Standard Criteria',
    description:
      'Flexible exhaust section diameter, length, connection, liner/interlock and material criteria.',
    targetProductTypeCodes: ['FLEX_PIPE'],
    items: [
      requiredComparable('ATTR_EXHAUST_INLET_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLEX_SECTION_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLEX_SECTION_DIAMETER', 40),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 50),
      optionalComparable('ATTR_FLEX_INTERLOCK_INCLUDED', 60),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 70),
      optionalComparable('ATTR_EXHAUST_OUTLET_TYPE', 80),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_EXHAUST_RESONATOR_V1',
    name: 'Exhaust Resonator Standard Criteria',
    description:
      'Resonator exhaust interfaces, body geometry, shape, overall length and material criteria.',
    targetProductTypeCodes: ['RESONATOR'],
    items: [
      requiredComparable('ATTR_EXHAUST_INLET_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_RESONATOR_BODY_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_BODY_WIDTH', 40),
      optionalComparable('ATTR_EXHAUST_BODY_HEIGHT', 50),
      optionalComparable('ATTR_EXHAUST_BODY_DIAMETER', 60),
      optionalComparable('ATTR_EXHAUST_BODY_SHAPE', 70),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 80),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_MUFFLER_V1',
    name: 'Muffler Standard Criteria',
    description:
      'Muffler inlet/outlet configuration, body geometry, connection positions, material and overall length criteria.',
    targetProductTypeCodes: ['MUFFLER'],
    items: [
      requiredComparable('ATTR_EXHAUST_INLET_QUANTITY', 10),
      requiredComparable('ATTR_EXHAUST_OUTLET_QUANTITY', 20),
      requiredComparable('ATTR_EXHAUST_INLET_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 50),
      optionalComparable('ATTR_EXHAUST_OUTLET_TYPE', 60),
      requiredComparable('ATTR_MUFFLER_SHELL_LENGTH', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_BODY_WIDTH', 80),
      optionalComparable('ATTR_EXHAUST_BODY_HEIGHT', 90),
      optionalComparable('ATTR_EXHAUST_BODY_DIAMETER', 100),
      optionalComparable('ATTR_EXHAUST_BODY_SHAPE', 110),
      optionalComparable('ATTR_MUFFLER_INLET_POSITION', 120),
      optionalComparable('ATTR_MUFFLER_OUTLET_POSITION', 130),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 140),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 150),
    ],
  },
  {
    code: 'CANON_TAILPIPE_V1',
    name: 'Tailpipe Standard Criteria',
    description:
      'Tailpipe diameter, length, inlet connection, outlet-tip geometry and material criteria.',
    targetProductTypeCodes: ['TAILPIPE'],
    items: [
      requiredComparable('ATTR_EXHAUST_PIPE_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_OVERALL_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 30),
      optionalComparable('ATTR_TAILPIPE_TIP_SHAPE', 40),
      optionalComparable('ATTR_TAILPIPE_TIP_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_EXHAUST_HANGER_V1',
    name: 'Exhaust Hanger Standard Criteria',
    description:
      'Exhaust hanger rod geometry, material, isolator and installation-position criteria.',
    targetProductTypeCodes: ['EXHAUST_HANGER'],
    items: [
      optionalComparable('ATTR_POSITION', 10),
      requiredComparable('ATTR_EXHAUST_HANGER_ROD_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LENGTH', 30),
      requiredComparable('ATTR_MATERIAL', 40),
      optionalComparable('ATTR_EXHAUST_HANGER_ISOLATOR_INCLUDED', 50),
    ],
  },
  {
    code: 'CANON_EXHAUST_CLAMP_V1',
    name: 'Exhaust Clamp Standard Criteria',
    description:
      'Exhaust clamp type, diameter, band width, bolt count and material criteria.',
    targetProductTypeCodes: ['EXHAUST_CLAMP'],
    items: [
      requiredComparable('ATTR_EXHAUST_CLAMP_TYPE', 10),
      requiredComparable('ATTR_EXHAUST_CLAMP_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_CLAMP_BAND_WIDTH', 30),
      optionalComparable('ATTR_BOLT_COUNT', 40),
      requiredComparable('ATTR_MATERIAL', 50),
    ],
  },
  {
    code: 'CANON_CATALYTIC_CONVERTER_V1',
    name: 'Catalytic Converter Standard Criteria',
    description:
      'Catalyst technology, substrate, emissions compliance, sensor interfaces and physical exhaust geometry criteria.',
    targetProductTypeCodes: ['CATALYTIC_CONVERTER'],
    items: [
      requiredComparable('ATTR_CATALYST_TYPE', 10),
      requiredComparable('ATTR_CATALYST_SUBSTRATE_TYPE', 20),
      optionalComparable('ATTR_CATALYST_SUBSTRATE_COUNT', 30),
      requiredComparable('ATTR_EMISSION_STANDARD', 40),
      optionalComparable('ATTR_CARB_CERTIFIED', 50),
      optionalComparable('ATTR_EPA_COMPLIANT', 60),
      requiredComparable('ATTR_EXHAUST_INLET_QUANTITY', 70),
      requiredComparable('ATTR_EXHAUST_OUTLET_QUANTITY', 80),
      requiredComparable('ATTR_EXHAUST_INLET_TYPE', 90),
      requiredComparable('ATTR_EXHAUST_OUTLET_TYPE', 100),
      optionalComparable('ATTR_EXHAUST_INLET_DIAMETER', 110),
      optionalComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 120),
      requiredComparable('ATTR_EXHAUST_BODY_LENGTH', 130, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_BODY_WIDTH', 140),
      optionalComparable('ATTR_EXHAUST_BODY_HEIGHT', 150),
      optionalComparable('ATTR_EXHAUST_BODY_DIAMETER', 160),
      optionalComparable('ATTR_EXHAUST_BODY_SHAPE', 170),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 180),
      optionalComparable('ATTR_OXYGEN_SENSOR_PORT_COUNT', 190),
      optionalComparable('ATTR_HEAT_SHIELD_INCLUDED', 200),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 210),
      criterion('ATTR_CERTIFICATION', 220, { filterable: true }),
    ],
  },
  {
    code: 'CANON_DPF_V1',
    name: 'Diesel Particulate Filter Standard Criteria',
    description:
      'DPF substrate, emissions, physical geometry, exhaust interfaces and pressure/temperature sensor-port criteria.',
    targetProductTypeCodes: ['DIESEL_PARTICULATE_FILTER'],
    items: [
      requiredComparable('ATTR_DPF_SUBSTRATE_MATERIAL', 10),
      requiredComparable('ATTR_EMISSION_STANDARD', 20),
      requiredComparable('ATTR_EXHAUST_INLET_DIAMETER', 30),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 50),
      optionalComparable('ATTR_EXHAUST_OUTLET_TYPE', 60),
      requiredComparable('ATTR_EXHAUST_BODY_LENGTH', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_BODY_WIDTH', 80),
      optionalComparable('ATTR_EXHAUST_BODY_HEIGHT', 90),
      optionalComparable('ATTR_EXHAUST_BODY_DIAMETER', 100),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 110),
      optionalComparable('ATTR_DPF_SENSOR_PORT_COUNT', 120),
      optionalComparable('ATTR_DPF_PRESSURE_PORT_COUNT', 130),
      optionalComparable('ATTR_DPF_TEMPERATURE_SENSOR_PORT_COUNT', 140),
      optionalComparable('ATTR_HEAT_SHIELD_INCLUDED', 150),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 160),
    ],
  },
  {
    code: 'CANON_SCR_CATALYST_V1',
    name: 'SCR Catalyst Standard Criteria',
    description:
      'Selective catalytic reduction substrate, emissions, dosing/sensor interfaces and physical exhaust geometry criteria.',
    targetProductTypeCodes: ['SCR_CATALYST'],
    items: [
      requiredComparable('ATTR_SCR_SUBSTRATE_TYPE', 10),
      requiredComparable('ATTR_EMISSION_STANDARD', 20),
      requiredComparable('ATTR_EXHAUST_INLET_DIAMETER', 30),
      requiredComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 40),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 50),
      optionalComparable('ATTR_EXHAUST_OUTLET_TYPE', 60),
      requiredComparable('ATTR_EXHAUST_BODY_LENGTH', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_BODY_WIDTH', 80),
      optionalComparable('ATTR_EXHAUST_BODY_HEIGHT', 90),
      optionalComparable('ATTR_EXHAUST_BODY_DIAMETER', 100),
      optionalComparable('ATTR_EXHAUST_OVERALL_LENGTH', 110),
      optionalComparable('ATTR_SCR_DOSING_PORT_COUNT', 120),
      optionalComparable('ATTR_SCR_SENSOR_PORT_COUNT', 130),
      optionalComparable('ATTR_HEAT_SHIELD_INCLUDED', 140),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 150),
    ],
  },
  {
    code: 'CANON_EGR_VALVE_V1',
    name: 'EGR Valve Standard Criteria',
    description:
      'EGR valve architecture, actuation, flow opening, coolant connection, integrated sensing and electrical interface criteria.',
    targetProductTypeCodes: ['EGR_VALVE'],
    items: [
      requiredComparable('ATTR_EGR_VALVE_TYPE', 10),
      requiredComparable('ATTR_EGR_ACTUATION_TYPE', 20),
      optionalComparable('ATTR_EGR_VALVE_OPENING_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EGR_POSITION_SENSOR_INCLUDED', 40),
      optionalComparable('ATTR_EGR_COOLANT_CONNECTION', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_CURRENT', 70),
      optionalComparable('ATTR_CONNECTOR_COUNT', 80),
      optionalComparable('ATTR_PIN_COUNT', 90, { variantDefining: true }),
      optionalComparable('ATTR_PROGRAMMABLE', 100),
      optionalComparable('ATTR_MOUNTING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_EGR_COOLER_V1',
    name: 'EGR Cooler Standard Criteria',
    description:
      'EGR heat-exchanger geometry, bypass architecture, coolant interfaces and exhaust connections.',
    targetProductTypeCodes: ['EGR_COOLER'],
    items: [
      requiredComparable('ATTR_EGR_COOLER_CORE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EGR_COOLER_CORE_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EGR_COOLER_CORE_THICKNESS', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EGR_BYPASS_VALVE_INCLUDED', 40),
      optionalComparable('ATTR_EGR_BYPASS_ACTUATION_TYPE', 50),
      optionalComparable('ATTR_EGR_COOLANT_PORT_COUNT', 60),
      optionalComparable('ATTR_EXHAUST_INLET_DIAMETER', 70),
      optionalComparable('ATTR_EXHAUST_OUTLET_DIAMETER', 80),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_EGR_PIPE_V1',
    name: 'EGR Pipe Standard Criteria',
    description:
      'EGR transfer-pipe diameter, length, connection, flange and material criteria.',
    targetProductTypeCodes: ['EGR_PIPE'],
    items: [
      requiredComparable('ATTR_EGR_PIPE_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EGR_PIPE_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_EXHAUST_INLET_TYPE', 30),
      optionalComparable('ATTR_EXHAUST_OUTLET_TYPE', 40),
      optionalComparable('ATTR_EXHAUST_FLANGE_BOLT_COUNT', 50),
      optionalComparable('ATTR_EXHAUST_FLANGE_BOLT_SPACING', 60),
      requiredComparable('ATTR_EXHAUST_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_SECONDARY_AIR_PUMP_V1',
    name: 'Secondary Air Pump Standard Criteria',
    description:
      'Secondary-air injection pump type, flow, electrical, air-port and connector criteria.',
    targetProductTypeCodes: ['SECONDARY_AIR_PUMP'],
    items: [
      requiredComparable('ATTR_SECONDARY_AIR_PUMP_TYPE', 10),
      requiredComparable('ATTR_SECONDARY_AIR_FLOW_RATE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_ELECTRICAL_POWER', 50),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_PIN_COUNT', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_OXYGEN_SENSOR_V1',
    name: 'Oxygen / Lambda Sensor Standard Criteria',
    description:
      'Lambda sensor technology, heater, thread, lead, signal and connector criteria.',
    targetProductTypeCodes: ['OXYGEN_SENSOR'],
    items: [
      requiredComparable('ATTR_LAMBDA_SENSOR_TYPE', 10),
      requiredComparable('ATTR_THREAD_SIZE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_LAMBDA_SENSOR_HEATED', 40),
      optionalComparable('ATTR_LAMBDA_HEATER_RESISTANCE', 50),
      requiredComparable('ATTR_LAMBDA_WIRE_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LAMBDA_CABLE_LENGTH', 70),
      optionalComparable('ATTR_LAMBDA_WRENCH_SIZE', 80),
      optionalComparable('ATTR_SIGNAL_TYPE', 90),
      optionalComparable('ATTR_VOLTAGE', 100),
      optionalComparable('ATTR_CONNECTOR_GENDER', 110),
      optionalComparable('ATTR_PIN_COUNT', 120),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 130),
    ],
  },
  {
    code: 'CANON_NOX_SENSOR_V1',
    name: 'NOx Sensor Standard Criteria',
    description:
      'NOx sensor construction, sensing-element thread, controller, cable and electrical/communication criteria.',
    targetProductTypeCodes: ['NOX_SENSOR'],
    items: [
      requiredComparable('ATTR_NOX_SENSOR_TYPE', 10),
      requiredComparable('ATTR_THREAD_SIZE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_NOX_SENSOR_CABLE_LENGTH', 40),
      optionalComparable('ATTR_NOX_CONTROL_MODULE_INCLUDED', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 70),
      optionalComparable('ATTR_CONNECTOR_COUNT', 80),
      optionalComparable('ATTR_PIN_COUNT', 90, { variantDefining: true }),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_EXHAUST_GAS_TEMPERATURE_SENSOR_V1',
    name: 'Exhaust Gas Temperature Sensor Standard Criteria',
    description:
      'Exhaust temperature sensor technology, thread, lead, electrical interface and temperature-range criteria.',
    targetProductTypeCodes: ['EXHAUST_GAS_TEMPERATURE_SENSOR'],
    items: [
      requiredComparable('ATTR_EGT_SENSOR_TYPE', 10),
      requiredComparable('ATTR_THREAD_SIZE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_THREAD_PITCH', 30),
      optionalComparable('ATTR_EGT_SENSOR_CABLE_LENGTH', 40),
      optionalComparable('ATTR_SIGNAL_TYPE', 50),
      optionalComparable('ATTR_RESISTANCE', 60),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_PIN_COUNT', 80, { variantDefining: true }),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 90),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_DPF_PRESSURE_SENSOR_V1',
    name: 'DPF Differential Pressure Sensor Standard Criteria',
    description:
      'DPF pressure sensor measurement range, hose interfaces, electrical output, response and connector criteria.',
    targetProductTypeCodes: ['DPF_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      requiredComparable('ATTR_DPF_DIFFERENTIAL_PRESSURE_MAX', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_DPF_PRESSURE_HOSE_PORT_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DPF_PRESSURE_HOSE_PORT_DIAMETER', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 70),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 80),
      requiredComparable('ATTR_PIN_COUNT', 90, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
      optionalComparable('ATTR_MOUNTING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_EGR_POSITION_SENSOR_V1',
    name: 'EGR Position Sensor Standard Criteria',
    description:
      'EGR position sensor technology, angular range, signal/output and connector criteria.',
    targetProductTypeCodes: ['EGR_POSITION_SENSOR'],
    items: [
      requiredComparable('ATTR_EGR_POSITION_SENSOR_TYPE', 10),
      optionalComparable('ATTR_EGR_POSITION_ANGLE_RANGE', 20),
      optionalComparable('ATTR_SIGNAL_TYPE', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_WIPER_BLADE_V1',
    name: 'Wiper Blade Standard Criteria',
    description:
      'Wiper blade construction, length, arm-adapter interface, connection width, spoiler and wiping-element material criteria.',
    targetProductTypeCodes: ['WIPER_BLADE'],
    items: [
      requiredComparable('ATTR_WIPER_BLADE_TYPE', 10),
      requiredComparable('ATTR_WIPER_BLADE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIPER_ADAPTER_TYPE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WIPER_CONNECTION_WIDTH', 40),
      optionalComparable('ATTR_WIPER_SPOILER_INCLUDED', 50),
      optionalComparable('ATTR_WIPER_RUBBER_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_WIPER_ARM_V1',
    name: 'Wiper Arm Standard Criteria',
    description:
      'Wiper arm length, attachment, pivot spline/bore geometry, blade-loading force and material criteria.',
    targetProductTypeCodes: ['WIPER_ARM'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_WIPER_ARM_ATTACHMENT_TYPE', 20),
      requiredComparable('ATTR_WIPER_ARM_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WIPER_ARM_SPLINE_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WIPER_ARM_BORE_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WIPER_ARM_SPRING_FORCE', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_WIPER_MOTOR_V1',
    name: 'Wiper Motor Standard Criteria',
    description:
      'Wiper motor electrical rating, output speeds/torque, rotation, gearbox, sensing, control, environmental and connector criteria.',
    targetProductTypeCodes: ['WIPER_MOTOR'],
    items: [
      requiredComparable('ATTR_WIPER_MOTOR_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_ELECTRICAL_POWER', 30),
      optionalComparable('ATTR_WIPER_MOTOR_MAX_CURRENT', 40),
      optionalComparable('ATTR_WIPER_MOTOR_SPEED_1', 50),
      optionalComparable('ATTR_WIPER_MOTOR_SPEED_2', 60),
      optionalComparable('ATTR_WIPER_MOTOR_TORQUE', 70),
      requiredComparable('ATTR_ROTATION_DIRECTION', 80),
      optionalComparable('ATTR_WIPER_MOTOR_GEAR_REDUCTION', 90),
      optionalComparable('ATTR_WIPER_MOTOR_COMMUTATION_TYPE', 100),
      optionalComparable('ATTR_WIPER_MOTOR_REGULATION_TYPE', 110),
      optionalComparable('ATTR_WIPER_HALL_SENSOR', 120),
      optionalComparable('ATTR_WIPER_TRANSMISSION_INCLUDED', 130),
      optionalComparable('ATTR_IP_RATING', 140),
      requiredComparable('ATTR_PIN_COUNT', 150, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 160),
      optionalComparable('ATTR_MOUNTING_TYPE', 170),
    ],
  },
  {
    code: 'CANON_WIPER_LINKAGE_V1',
    name: 'Wiper Linkage Standard Criteria',
    description:
      'Wiper linkage/transmission construction, geometry, pivot count, supplied motor and material criteria.',
    targetProductTypeCodes: ['WIPER_LINKAGE'],
    items: [
      requiredComparable('ATTR_WIPER_LINKAGE_TYPE', 10),
      requiredComparable('ATTR_WIPER_LINKAGE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIPER_LINKAGE_PIVOT_COUNT', 30),
      optionalComparable('ATTR_WIPER_LINKAGE_ROD_DIAMETER', 40),
      optionalComparable('ATTR_WIPER_LINKAGE_MOTOR_INCLUDED', 50),
      optionalComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
    ],
  },
  {
    code: 'CANON_WIPER_PIVOT_V1',
    name: 'Wiper Pivot Standard Criteria',
    description:
      'Wiper pivot/spindle shaft diameter, length, spline and mounting-thread geometry criteria.',
    targetProductTypeCodes: ['WIPER_PIVOT'],
    items: [
      requiredComparable('ATTR_WIPER_PIVOT_SHAFT_DIAMETER', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIPER_PIVOT_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WIPER_PIVOT_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WIPER_PIVOT_THREAD_DIAMETER', 40),
      optionalComparable('ATTR_THREAD_SIZE', 50),
      optionalComparable('ATTR_THREAD_PITCH', 60),
      optionalComparable('ATTR_MATERIAL', 70),
    ],
  },
  {
    code: 'CANON_WASHER_PUMP_V1',
    name: 'Windshield / Headlight Washer Pump Standard Criteria',
    description:
      'Washer pump construction, outlet count, electrical rating, flow, pressure, reversible operation and connector criteria.',
    targetProductTypeCodes: ['WASHER_PUMP', 'HEADLIGHT_WASHER_PUMP'],
    items: [
      requiredComparable('ATTR_WASHER_PUMP_TYPE', 10),
      requiredComparable('ATTR_WASHER_PUMP_OUTLET_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_VOLTAGE', 30, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_WASHER_PUMP_FLOW_RATE', 50),
      optionalComparable('ATTR_WASHER_PUMP_PRESSURE', 60),
      optionalComparable('ATTR_WASHER_PUMP_REVERSIBLE', 70),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_PIN_COUNT', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_WASHER_RESERVOIR_V1',
    name: 'Washer Reservoir Standard Criteria',
    description:
      'Washer-fluid reservoir capacity, geometry, material, ports, supplied pumps and level-sensor criteria.',
    targetProductTypeCodes: ['WASHER_RESERVOIR'],
    items: [
      requiredComparable('ATTR_WASHER_RESERVOIR_CAPACITY', 10, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LENGTH', 20),
      optionalComparable('ATTR_WIDTH', 30),
      optionalComparable('ATTR_HEIGHT', 40),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_WASHER_RESERVOIR_PORT_COUNT', 60),
      optionalComparable('ATTR_WASHER_RESERVOIR_PUMP_INCLUDED', 70),
      optionalComparable('ATTR_WASHER_RESERVOIR_LEVEL_SENSOR_INCLUDED', 80),
    ],
  },
  {
    code: 'CANON_WASHER_NOZZLE_V1',
    name: 'Washer Nozzle Standard Criteria',
    description:
      'Washer nozzle construction, jet count, heating, spray pattern, flow, angle and electrical-interface criteria.',
    targetProductTypeCodes: ['WASHER_NOZZLE'],
    items: [
      requiredComparable('ATTR_WASHER_NOZZLE_TYPE', 10),
      requiredComparable('ATTR_WASHER_NOZZLE_HOLE_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WASHER_NOZZLE_HEATED', 30),
      optionalComparable('ATTR_WASHER_NOZZLE_SPRAY_PATTERN', 40),
      optionalComparable('ATTR_WASHER_NOZZLE_FLOW_RATE', 50),
      optionalComparable('ATTR_WASHER_NOZZLE_ANGLE', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_PIN_COUNT', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_WASHER_HOSE_V1',
    name: 'Washer Hose Standard Criteria',
    description:
      'Washer-fluid hose length, bore, outside diameter, working pressure, material and connection criteria.',
    targetProductTypeCodes: ['WASHER_HOSE'],
    items: [
      requiredComparable('ATTR_WASHER_HOSE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_WASHER_HOSE_INNER_DIAMETER', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WASHER_HOSE_OUTER_DIAMETER', 30),
      optionalComparable('ATTR_WASHER_HOSE_MAX_PRESSURE', 40),
      requiredComparable('ATTR_WASHER_HOSE_MATERIAL', 50),
      optionalComparable('ATTR_CONNECTION_1', 60),
      optionalComparable('ATTR_CONNECTION_2', 70),
    ],
  },
  {
    code: 'CANON_AC_COMPRESSOR_V1',
    name: 'A/C Compressor Standard Criteria',
    description:
      'A/C compressor construction, refrigerant/oil, displacement, drive, pulley, electrical and refrigerant-port criteria. Exact vehicle charge quantity remains application-specific.',
    targetProductTypeCodes: ['AC_COMPRESSOR'],
    items: [
      requiredComparable('ATTR_AC_COMPRESSOR_TYPE', 10),
      requiredComparable('ATTR_REFRIGERANT_TYPE', 20),
      requiredComparable('ATTR_AC_COMPRESSOR_OIL_TYPE', 30),
      optionalComparable('ATTR_AC_COMPRESSOR_OIL_CAPACITY', 40),
      optionalComparable('ATTR_AC_COMPRESSOR_DISPLACEMENT', 50),
      optionalComparable('ATTR_AC_COMPRESSOR_ELECTRIC_DRIVE', 60),
      optionalComparable('ATTR_AC_COMPRESSOR_CLUTCH_INCLUDED', 70),
      optionalComparable('ATTR_PULLEY_DIAMETER', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PULLEY_RIB_COUNT', 90),
      optionalComparable('ATTR_VOLTAGE', 100),
      optionalComparable('ATTR_CURRENT', 110),
      optionalComparable('ATTR_ELECTRICAL_POWER', 120),
      optionalComparable('ATTR_AC_COMPRESSOR_SUCTION_PORT_DIAMETER', 130, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_AC_COMPRESSOR_DISCHARGE_PORT_DIAMETER', 140, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 150),
    ],
  },
  {
    code: 'CANON_AC_CONDENSER_V1',
    name: 'A/C Condenser Standard Criteria',
    description:
      'A/C condenser refrigerant, core geometry, fluid interfaces, integrated drier, material and pressure criteria.',
    targetProductTypeCodes: ['AC_CONDENSER'],
    items: [
      requiredComparable('ATTR_REFRIGERANT_TYPE', 10),
      requiredComparable('ATTR_CONDENSER_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDENSER_WIDTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDENSER_THICKNESS', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CONDENSER_INLET_DIAMETER', 50),
      requiredComparable('ATTR_CONDENSER_OUTLET_DIAMETER', 60),
      optionalComparable('ATTR_CONDENSER_DRIER_INCLUDED', 70),
      optionalComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_COOLING_PRESSURE_RATING', 90),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 100),
    ],
  },
  {
    code: 'CANON_AC_EVAPORATOR_V1',
    name: 'A/C Evaporator Standard Criteria',
    description:
      'A/C evaporator refrigerant, core geometry, inlet/outlet, material and pressure criteria.',
    targetProductTypeCodes: ['AC_EVAPORATOR'],
    items: [
      requiredComparable('ATTR_REFRIGERANT_TYPE', 10),
      requiredComparable('ATTR_EVAPORATOR_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EVAPORATOR_WIDTH', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EVAPORATOR_THICKNESS', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EVAPORATOR_INLET_DIAMETER', 50),
      requiredComparable('ATTR_EVAPORATOR_OUTLET_DIAMETER', 60),
      optionalComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_COOLING_PRESSURE_RATING', 80),
    ],
  },
  {
    code: 'CANON_AC_EXPANSION_VALVE_V1',
    name: 'A/C Expansion Valve Standard Criteria',
    description:
      'Refrigerant expansion-valve architecture, refrigerant compatibility, port geometry, pressure and mounting criteria.',
    targetProductTypeCodes: ['AC_EXPANSION_VALVE'],
    items: [
      requiredComparable('ATTR_EXPANSION_VALVE_TYPE', 10),
      requiredComparable('ATTR_REFRIGERANT_TYPE', 20),
      requiredComparable('ATTR_EXPANSION_VALVE_PORT_COUNT', 30),
      requiredComparable('ATTR_EXPANSION_VALVE_INLET_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_EXPANSION_VALVE_OUTLET_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
    ],
  },
  {
    code: 'CANON_AC_RECEIVER_DRIER_V1',
    name: 'A/C Receiver Drier Standard Criteria',
    description:
      'Receiver-drier construction, refrigerant, desiccant, body geometry, connections, material and pressure criteria.',
    targetProductTypeCodes: ['AC_RECEIVER_DRIER'],
    items: [
      requiredComparable('ATTR_DRIER_TYPE', 10),
      requiredComparable('ATTR_REFRIGERANT_TYPE', 20),
      requiredComparable('ATTR_DESICCANT_TYPE', 30),
      requiredComparable('ATTR_DRIER_BODY_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_DRIER_BODY_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
      optionalComparable('ATTR_MATERIAL', 90),
      optionalComparable('ATTR_CONNECTION_1', 100),
      optionalComparable('ATTR_CONNECTION_2', 110),
    ],
  },
  {
    code: 'CANON_AC_ACCUMULATOR_V1',
    name: 'A/C Accumulator Standard Criteria',
    description:
      'A/C accumulator construction, refrigerant, desiccant, body geometry, connections and pressure criteria.',
    targetProductTypeCodes: ['AC_ACCUMULATOR'],
    items: [
      requiredComparable('ATTR_ACCUMULATOR_TYPE', 10),
      requiredComparable('ATTR_REFRIGERANT_TYPE', 20),
      optionalComparable('ATTR_DESICCANT_TYPE', 30),
      requiredComparable('ATTR_ACCUMULATOR_BODY_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_ACCUMULATOR_BODY_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_INLET_DIAMETER', 60),
      optionalComparable('ATTR_OUTLET_DIAMETER', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
      optionalComparable('ATTR_MATERIAL', 90),
    ],
  },
  {
    code: 'CANON_AC_HOSE_V1',
    name: 'A/C Hose Standard Criteria',
    description:
      'Refrigerant hose length, bore, end fittings, material, refrigerant and operating-limit criteria.',
    targetProductTypeCodes: ['AC_HOSE'],
    items: [
      requiredComparable('ATTR_REFRIGERANT_TYPE', 10),
      requiredComparable('ATTR_AC_HOSE_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AC_HOSE_INNER_DIAMETER_1', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AC_HOSE_INNER_DIAMETER_2', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AC_HOSE_FITTING_TYPE_1', 50),
      requiredComparable('ATTR_AC_HOSE_FITTING_TYPE_2', 60),
      requiredComparable('ATTR_MATERIAL', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 90),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_AC_PRESSURE_SENSOR_V1',
    name: 'A/C Pressure Sensor Standard Criteria',
    description:
      'A/C refrigerant pressure sensor technology, pressure range, electrical output, response, thread and connector criteria.',
    targetProductTypeCodes: ['AC_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_REFRIGERANT_TYPE', 20),
      optionalComparable('ATTR_OPERATING_PRESSURE_MIN', 30),
      requiredComparable('ATTR_OPERATING_PRESSURE_MAX', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 70),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 80),
      optionalComparable('ATTR_THREAD_SIZE', 90),
      requiredComparable('ATTR_PIN_COUNT', 100, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 110),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 120),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 130),
    ],
  },
  {
    code: 'CANON_HEATER_CORE_V1',
    name: 'Heater Core Standard Criteria',
    description:
      'Cabin heater-core heat-exchanger geometry, coolant connections, material and pressure criteria.',
    targetProductTypeCodes: ['HEATER_CORE'],
    items: [
      requiredComparable('ATTR_HEATER_CORE_LENGTH', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HEATER_CORE_WIDTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HEATER_CORE_THICKNESS', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_HEATER_CORE_INLET_DIAMETER', 40),
      requiredComparable('ATTR_HEATER_CORE_OUTLET_DIAMETER', 50),
      optionalComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_COOLING_PRESSURE_RATING', 70),
    ],
  },
  {
    code: 'CANON_HEATER_CONTROL_VALVE_V1',
    name: 'Heater Control Valve Standard Criteria',
    description:
      'Heater control-valve architecture, actuation, coolant ports, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['HEATER_CONTROL_VALVE'],
    items: [
      requiredComparable('ATTR_HEATER_CONTROL_VALVE_TYPE', 10),
      requiredComparable('ATTR_HEATER_CONTROL_VALVE_ACTUATION', 20),
      optionalComparable('ATTR_PORT_COUNT', 30),
      optionalComparable('ATTR_INLET_DIAMETER', 40),
      optionalComparable('ATTR_OUTLET_DIAMETER', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_CURRENT', 70),
      optionalComparable('ATTR_PIN_COUNT', 80),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_AUXILIARY_HEATER_V1',
    name: 'Auxiliary Heater Standard Criteria',
    description:
      'Auxiliary heater technology, output, electrical, fluid-interface and mounting criteria.',
    targetProductTypeCodes: ['AUXILIARY_HEATER'],
    items: [
      requiredComparable('ATTR_AUXILIARY_HEATER_TYPE', 10),
      requiredComparable('ATTR_AUXILIARY_HEATER_OUTPUT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_ELECTRICAL_POWER', 50),
      optionalComparable('ATTR_PORT_COUNT', 60),
      optionalComparable('ATTR_INLET_DIAMETER', 70),
      optionalComparable('ATTR_OUTLET_DIAMETER', 80),
      optionalComparable('ATTR_PIN_COUNT', 90),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
      optionalComparable('ATTR_MOUNTING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_BLOWER_MOTOR_V1',
    name: 'Blower Motor Standard Criteria',
    description:
      'Cabin blower motor construction, electrical rating, wheel geometry, speed, rotation and connector criteria.',
    targetProductTypeCodes: ['BLOWER_MOTOR'],
    items: [
      requiredComparable('ATTR_BLOWER_MOTOR_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_ELECTRICAL_POWER', 40),
      optionalComparable('ATTR_BLOWER_WHEEL_DIAMETER', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_BLOWER_BLADE_COUNT', 60),
      optionalComparable('ATTR_BLOWER_MAX_SPEED', 70),
      optionalComparable('ATTR_ROTATION_DIRECTION', 80),
      requiredComparable('ATTR_PIN_COUNT', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
      optionalComparable('ATTR_MOUNTING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_BLOWER_RESISTOR_V1',
    name: 'Blower Motor Resistor Standard Criteria',
    description:
      'Blower speed-control type, stages, electrical/resistance data, connector and thermal criteria.',
    targetProductTypeCodes: ['BLOWER_RESISTOR'],
    items: [
      requiredComparable('ATTR_BLOWER_RESISTOR_TYPE', 10),
      optionalComparable('ATTR_BLOWER_STAGE_COUNT', 20),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      optionalComparable('ATTR_RESISTANCE', 50),
      optionalComparable('ATTR_ELECTRICAL_POWER', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_BLEND_DOOR_ACTUATOR_V1',
    name: 'Blend Door Actuator Standard Criteria',
    description:
      'HVAC flap actuator type, angular travel, electrical, communication and mounting criteria.',
    targetProductTypeCodes: ['BLEND_DOOR_ACTUATOR'],
    items: [
      requiredComparable('ATTR_ACTUATOR_TYPE', 10),
      optionalComparable('ATTR_HVAC_ACTUATOR_ANGLE_RANGE', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_CURRENT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 60),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_HVAC_CONTROL_MODULE_V1',
    name: 'HVAC Control Module Standard Criteria',
    description:
      'HVAC controller electrical, connector, communication, programming, zone and control-channel criteria.',
    targetProductTypeCodes: ['HVAC_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      requiredComparable('ATTR_CONNECTOR_COUNT', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 50),
      optionalComparable('ATTR_PROGRAMMABLE', 60),
      optionalComparable('ATTR_HVAC_ZONE_COUNT', 70),
      optionalComparable('ATTR_CONTROL_CHANNEL_COUNT', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_CABIN_TEMPERATURE_SENSOR_V1',
    name: 'Cabin Temperature Sensor Standard Criteria',
    description:
      'Cabin temperature sensor technology, electrical/signal characteristics, response, aspirator and connector criteria.',
    targetProductTypeCodes: ['CABIN_TEMPERATURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_RESISTANCE', 30),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 50),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 60),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 70),
      optionalComparable('ATTR_CABIN_SENSOR_ASPIRATOR_INCLUDED', 80),
      requiredComparable('ATTR_PIN_COUNT', 90, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 100),
      optionalComparable('ATTR_MOUNTING_TYPE', 110),
    ],
  },
  {
    code: 'CANON_CYLINDER_HEAD_GASKET_V1',
    name: 'Cylinder Head Gasket Standard Criteria',
    description:
      'Cylinder-head gasket construction, thickness/repair grade, bore geometry and sealing reinforcement criteria. Exact engine application remains structured fitment.',
    targetProductTypeCodes: ['CYLINDER_HEAD_GASKET'],
    items: [
      requiredComparable('ATTR_GASKET_CONSTRUCTION', 10),
      requiredComparable('ATTR_GASKET_MATERIAL', 20),
      requiredComparable('ATTR_GASKET_THICKNESS', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_GASKET_BORE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_GASKET_BORE_COUNT', 50),
      optionalComparable('ATTR_GASKET_LAYER_COUNT', 60),
      optionalComparable('ATTR_GASKET_REPAIR_STAGE', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GASKET_IDENTIFICATION_NOTCH_COUNT', 80),
      optionalComparable('ATTR_GASKET_IDENTIFICATION_HOLE_COUNT', 90),
      optionalComparable('ATTR_GASKET_COATING', 100),
      optionalComparable('ATTR_FIRE_RING_INCLUDED', 110),
    ],
  },
  {
    code: 'CANON_VALVE_COVER_GASKET_V1',
    name: 'Valve Cover Gasket Standard Criteria',
    description:
      'Valve-cover gasket construction, material, dimensions, ports and mounting-hole criteria.',
    targetProductTypeCodes: ['VALVE_COVER_GASKET'],
    items: [
      requiredComparable('ATTR_GASKET_CONSTRUCTION', 10),
      requiredComparable('ATTR_GASKET_MATERIAL', 20),
      optionalComparable('ATTR_GASKET_THICKNESS', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_GASKET_PORT_COUNT', 60),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 70),
      optionalComparable('ATTR_GASKET_COATING', 80),
    ],
  },
  {
    code: 'CANON_OIL_PAN_GASKET_V1',
    name: 'Oil Pan Gasket Standard Criteria',
    description:
      'Oil-pan gasket construction, material, dimensions and mounting-hole criteria.',
    targetProductTypeCodes: ['OIL_PAN_GASKET'],
    items: [
      requiredComparable('ATTR_GASKET_CONSTRUCTION', 10),
      requiredComparable('ATTR_GASKET_MATERIAL', 20),
      optionalComparable('ATTR_GASKET_THICKNESS', 30),
      optionalComparable('ATTR_LENGTH', 40, { variantDefining: true }),
      optionalComparable('ATTR_WIDTH', 50, { variantDefining: true }),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_GASKET_COATING', 70),
    ],
  },
  {
    code: 'CANON_INTAKE_MANIFOLD_GASKET_V1',
    name: 'Intake Manifold Gasket Standard Criteria',
    description:
      'Intake-manifold gasket construction, material, thickness, port count and mounting-hole criteria.',
    targetProductTypeCodes: ['INTAKE_MANIFOLD_GASKET'],
    items: [
      requiredComparable('ATTR_GASKET_CONSTRUCTION', 10),
      requiredComparable('ATTR_GASKET_MATERIAL', 20),
      optionalComparable('ATTR_GASKET_THICKNESS', 30),
      requiredComparable('ATTR_GASKET_PORT_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GASKET_BORE_DIAMETER', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_GASKET_COATING', 70),
    ],
  },
  {
    code: 'CANON_EXHAUST_MANIFOLD_GASKET_V1',
    name: 'Exhaust Manifold Gasket Standard Criteria',
    description:
      'Exhaust-manifold gasket construction, heat-resistant material, thickness, port count and mounting-hole criteria.',
    targetProductTypeCodes: ['EXHAUST_MANIFOLD_GASKET'],
    items: [
      requiredComparable('ATTR_GASKET_CONSTRUCTION', 10),
      requiredComparable('ATTR_GASKET_MATERIAL', 20),
      optionalComparable('ATTR_GASKET_THICKNESS', 30),
      requiredComparable('ATTR_GASKET_PORT_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GASKET_BORE_DIAMETER', 50),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 60),
      optionalComparable('ATTR_GASKET_COATING', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_FULL_GASKET_SET_V1',
    name: 'Full Engine Gasket Set Standard Criteria',
    description:
      'Full-engine gasket set service scope, piece count and package-content criteria.',
    targetProductTypeCodes: ['FULL_GASKET_SET'],
    items: [
      requiredComparable('ATTR_GASKET_SET_SCOPE', 10),
      requiredComparable('ATTR_GASKET_SET_PIECE_COUNT', 20, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_HEAD_GASKET_SET_V1',
    name: 'Cylinder Head Gasket Set Standard Criteria',
    description:
      'Cylinder-head/upper-engine gasket set scope, piece count and head-gasket identification criteria.',
    targetProductTypeCodes: ['HEAD_GASKET_SET'],
    items: [
      requiredComparable('ATTR_GASKET_SET_SCOPE', 10),
      requiredComparable('ATTR_GASKET_SET_PIECE_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_GASKET_CONSTRUCTION', 30),
      optionalComparable('ATTR_GASKET_THICKNESS', 40),
      optionalComparable('ATTR_GASKET_BORE_DIAMETER', 50),
      optionalComparable('ATTR_GASKET_BORE_COUNT', 60),
    ],
  },
  {
    code: 'CANON_CRANKSHAFT_SEAL_V1',
    name: 'Crankshaft Oil Seal Standard Criteria',
    description:
      'Crankshaft radial shaft-seal dimensions, lip design, material, spring and operating criteria.',
    targetProductTypeCodes: ['CRANKSHAFT_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      optionalComparable('ATTR_RADIAL_SEAL_DESIGN', 20),
      requiredComparable('ATTR_SEAL_MATERIAL', 30),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_LIP_COUNT', 70),
      optionalComparable('ATTR_SEAL_AUXILIARY_LIP', 80),
      optionalComparable('ATTR_SEAL_GARTER_SPRING', 90),
      optionalComparable('ATTR_SEAL_OUTSIDE_DIAMETER_TYPE', 100),
      optionalComparable('ATTR_SEAL_CASE_MATERIAL', 110),
      optionalComparable('ATTR_ROTATION_DIRECTION', 120),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 130),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 140),
    ],
  },
  {
    code: 'CANON_CAMSHAFT_SEAL_V1',
    name: 'Camshaft Oil Seal Standard Criteria',
    description:
      'Camshaft radial shaft-seal dimensions, lip design, material, spring and operating criteria.',
    targetProductTypeCodes: ['CAMSHAFT_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      optionalComparable('ATTR_RADIAL_SEAL_DESIGN', 20),
      requiredComparable('ATTR_SEAL_MATERIAL', 30),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_LIP_COUNT', 70),
      optionalComparable('ATTR_SEAL_AUXILIARY_LIP', 80),
      optionalComparable('ATTR_SEAL_GARTER_SPRING', 90),
      optionalComparable('ATTR_SEAL_OUTSIDE_DIAMETER_TYPE', 100),
      optionalComparable('ATTR_SEAL_CASE_MATERIAL', 110),
      optionalComparable('ATTR_ROTATION_DIRECTION', 120),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 130),
    ],
  },
  {
    code: 'CANON_VALVE_STEM_SEAL_SET_V1',
    name: 'Valve Stem Seal Set Standard Criteria',
    description:
      'Valve-stem seal set material, bore/outer geometry, lip design and piece-count criteria.',
    targetProductTypeCodes: ['VALVE_STEM_SEAL_SET'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 40),
      optionalComparable('ATTR_SEAL_WIDTH', 50),
      optionalComparable('ATTR_SEAL_LIP_COUNT', 60),
      optionalComparable('ATTR_SEAL_GARTER_SPRING', 70),
      requiredComparable('ATTR_GASKET_SET_PIECE_COUNT', 80, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_OIL_PUMP_SEAL_V1',
    name: 'Oil Pump Seal Standard Criteria',
    description:
      'Oil-pump shaft/housing seal type, material, dimensions and lip/spring criteria.',
    targetProductTypeCodes: ['OIL_PUMP_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      optionalComparable('ATTR_RADIAL_SEAL_DESIGN', 20),
      requiredComparable('ATTR_SEAL_MATERIAL', 30),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_LIP_COUNT', 70),
      optionalComparable('ATTR_SEAL_GARTER_SPRING', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 90),
    ],
  },
  {
    code: 'CANON_O_RING_V1',
    name: 'O-Ring Standard Criteria',
    description:
      'O-ring inside diameter, cross-section, elastomer material, hardness and operating-limit criteria.',
    targetProductTypeCodes: ['O_RING'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_O_RING_CROSS_SECTION_DIAMETER', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_ELASTOMER_HARDNESS', 50),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 60),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 70),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 80),
    ],
  },
  {
    code: 'CANON_SHAFT_SEAL_V1',
    name: 'Shaft Seal Standard Criteria',
    description:
      'Generic radial shaft-seal dimensions, design, lip material, spring and operating criteria.',
    targetProductTypeCodes: ['SHAFT_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_RADIAL_SEAL_DESIGN', 20),
      requiredComparable('ATTR_SEAL_MATERIAL', 30),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 50, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAL_LIP_COUNT', 70),
      optionalComparable('ATTR_SEAL_AUXILIARY_LIP', 80),
      optionalComparable('ATTR_SEAL_GARTER_SPRING', 90),
      optionalComparable('ATTR_SEAL_OUTSIDE_DIAMETER_TYPE', 100),
      optionalComparable('ATTR_SEAL_CASE_MATERIAL', 110),
      optionalComparable('ATTR_ROTATION_DIRECTION', 120),
      optionalComparable('ATTR_MAX_ROTATIONAL_SPEED', 130),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 140),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 150),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 160),
    ],
  },
  {
    code: 'CANON_GASKET_SHEET_V1',
    name: 'Gasket Sheet Standard Criteria',
    description:
      'Cut-your-own gasket sheet material, dimensions, thickness and temperature/pressure limits.',
    targetProductTypeCodes: ['GASKET_SHEET'],
    items: [
      requiredComparable('ATTR_GASKET_MATERIAL', 10),
      requiredComparable('ATTR_LENGTH', 20, { variantDefining: true }),
      requiredComparable('ATTR_WIDTH', 30, { variantDefining: true }),
      requiredComparable('ATTR_GASKET_THICKNESS', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 50),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 60),
    ],
  },
  {
    code: 'CANON_COPPER_SEAL_WASHER_V1',
    name: 'Copper Sealing Washer Standard Criteria',
    description:
      'Copper sealing washer inside/outside diameter, thickness and material criteria.',
    targetProductTypeCodes: ['COPPER_SEAL_WASHER'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_MATERIAL', 20),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 50, {
        variantDefining: true,
      }),
    ],
  },
  {
    code: 'CANON_BONDED_SEAL_V1',
    name: 'Bonded Seal Standard Criteria',
    description:
      'Bonded metal/elastomer sealing washer geometry, materials, hardness and operating-limit criteria.',
    targetProductTypeCodes: ['BONDED_SEAL'],
    items: [
      requiredComparable('ATTR_SEAL_TYPE', 10),
      requiredComparable('ATTR_SEAL_INSIDE_DIAMETER', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_OUTSIDE_DIAMETER', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAL_WIDTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_BONDED_SEAL_METAL_MATERIAL', 50),
      requiredComparable('ATTR_BONDED_SEAL_ELASTOMER_MATERIAL', 60),
      optionalComparable('ATTR_ELASTOMER_HARDNESS', 70),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 90),
      optionalComparable('ATTR_OPERATING_PRESSURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_SEAT_BELT_ASSEMBLY_V1',
    name: 'Seat Belt Assembly Standard Criteria',
    description:
      'Seat-belt restraint architecture, webbing, retractor, pretensioner and load-limiter criteria. Exact seating-position application remains structured fitment.',
    targetProductTypeCodes: ['SEAT_BELT_ASSEMBLY'],
    items: [
      requiredComparable('ATTR_SEAT_BELT_TYPE', 10),
      requiredComparable('ATTR_SEAT_BELT_POINT_COUNT', 20),
      optionalComparable('ATTR_SEAT_BELT_WEBBING_WIDTH', 30),
      optionalComparable('ATTR_SEAT_BELT_LENGTH', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_SEAT_BELT_RETRACTOR_TYPE', 50),
      optionalComparable('ATTR_SEAT_BELT_PRETENSIONER_INCLUDED', 60),
      optionalComparable('ATTR_SEAT_BELT_PRETENSIONER_TYPE', 70),
      optionalComparable('ATTR_SEAT_BELT_LOAD_LIMITER_INCLUDED', 80),
      optionalComparable('ATTR_SEAT_BELT_LOAD_LIMITER_TYPE', 90),
      optionalComparable('ATTR_SEAT_BELT_ADAPTIVE_RETRACTOR', 100),
      optionalComparable('ATTR_SIDE', 110),
    ],
  },
  {
    code: 'CANON_SEAT_BELT_BUCKLE_V1',
    name: 'Seat Belt Buckle Standard Criteria',
    description:
      'Seat-belt buckle construction, stalk length, electrical switch and connector criteria.',
    targetProductTypeCodes: ['SEAT_BELT_BUCKLE'],
    items: [
      requiredComparable('ATTR_SEAT_BELT_BUCKLE_TYPE', 10),
      optionalComparable('ATTR_SEAT_BELT_BUCKLE_STALK_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAT_BELT_BUCKLE_SWITCH_INCLUDED', 30),
      optionalComparable('ATTR_SIDE', 40),
      optionalComparable('ATTR_CONNECTOR_GENDER', 50),
      optionalComparable('ATTR_PIN_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
    ],
  },
  {
    code: 'CANON_AIRBAG_MODULE_V1',
    name: 'Airbag Module Standard Criteria',
    description:
      'Airbag module type, inflator architecture, stage count, deployment orientation and electrical interface criteria.',
    targetProductTypeCodes: ['AIRBAG_MODULE'],
    items: [
      requiredComparable('ATTR_AIRBAG_TYPE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AIRBAG_STAGE_COUNT', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_AIRBAG_INFLATOR_TYPE', 30),
      optionalComparable('ATTR_AIRBAG_DEPLOYMENT_DIRECTION', 40),
      optionalComparable('ATTR_SIDE', 50),
      optionalComparable('ATTR_CONNECTOR_COUNT', 60),
      optionalComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_AIRBAG_CLOCK_SPRING_V1',
    name: 'Airbag Clock Spring Standard Criteria',
    description:
      'Steering clock-spring circuit capacity, usable turns and electrical interface criteria.',
    targetProductTypeCodes: ['AIRBAG_CLOCK_SPRING'],
    items: [
      requiredComparable('ATTR_CLOCK_SPRING_CIRCUIT_COUNT', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_CLOCK_SPRING_TURN_COUNT', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_COUNT', 30),
      requiredComparable('ATTR_PIN_COUNT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_MOUNTING_TYPE', 50),
    ],
  },
  {
    code: 'CANON_AIRBAG_CONTROL_MODULE_V1',
    name: 'Airbag Control Module Standard Criteria',
    description:
      'Supplemental-restraint controller electrical, channel, connector, communication and programming criteria.',
    targetProductTypeCodes: ['AIRBAG_CONTROL_MODULE'],
    items: [
      requiredComparable('ATTR_VOLTAGE', 10),
      optionalComparable('ATTR_CURRENT', 20),
      optionalComparable('ATTR_AIRBAG_CONTROL_CHANNEL_COUNT', 30),
      requiredComparable('ATTR_CONNECTOR_COUNT', 40),
      requiredComparable('ATTR_PIN_COUNT', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 60),
      optionalComparable('ATTR_PROGRAMMABLE', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MIN', 90),
      optionalComparable('ATTR_OPERATING_TEMPERATURE_MAX', 100),
    ],
  },
  {
    code: 'CANON_IMPACT_SENSOR_V1',
    name: 'Airbag Impact Sensor Standard Criteria',
    description:
      'Crash/impact sensor sensing technology, axis count, acceleration range, response and electrical-interface criteria.',
    targetProductTypeCodes: ['IMPACT_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SAFETY_SENSOR_AXIS_COUNT', 20),
      requiredComparable('ATTR_IMPACT_SENSOR_ACCELERATION_RANGE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 40),
      optionalComparable('ATTR_SIGNAL_TYPE', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_ABS_WHEEL_SPEED_SENSOR_V1',
    name: 'ABS Wheel Speed Sensor Standard Criteria',
    description:
      'ABS wheel-speed sensor technology, signal, cable, electrical and mounting criteria.',
    targetProductTypeCodes: ['ABS_WHEEL_SPEED_SENSOR'],
    items: [
      requiredComparable('ATTR_WHEEL_SPEED_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_WHEEL_SPEED_SENSOR_CABLE_LENGTH', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_RESISTANCE', 50),
      requiredComparable('ATTR_PIN_COUNT', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 70),
      optionalComparable('ATTR_MOUNTING_TYPE', 80),
    ],
  },
  {
    code: 'CANON_YAW_RATE_SENSOR_V1',
    name: 'Yaw Rate Sensor Standard Criteria',
    description:
      'Vehicle-dynamics yaw sensor axes, angular-rate range, acceleration range and electronic interface criteria.',
    targetProductTypeCodes: ['YAW_RATE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SAFETY_SENSOR_AXIS_COUNT', 20),
      requiredComparable('ATTR_YAW_RATE_RANGE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_LATERAL_ACCELERATION_RANGE', 40),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 70),
      requiredComparable('ATTR_PIN_COUNT', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_LATERAL_ACCELERATION_SENSOR_V1',
    name: 'Lateral Acceleration Sensor Standard Criteria',
    description:
      'Vehicle-dynamics lateral-acceleration sensor axes, range, response and electrical-interface criteria.',
    targetProductTypeCodes: ['LATERAL_ACCELERATION_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SAFETY_SENSOR_AXIS_COUNT', 20),
      requiredComparable('ATTR_LATERAL_ACCELERATION_RANGE', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 40),
      optionalComparable('ATTR_SIGNAL_TYPE', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 70),
      requiredComparable('ATTR_PIN_COUNT', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_PRESSURE_SENSOR_V1',
    name: 'Brake Pressure Sensor Standard Criteria',
    description:
      'Brake hydraulic-pressure sensor range, supply/output, response, thread and electrical-interface criteria.',
    targetProductTypeCodes: ['BRAKE_PRESSURE_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      requiredComparable('ATTR_BRAKE_PRESSURE_SENSOR_RANGE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 30),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 40),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 50),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 60),
      optionalComparable('ATTR_THREAD_SIZE', 70, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_PIN_COUNT', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 90),
    ],
  },
  {
    code: 'CANON_PARKING_SENSOR_V1',
    name: 'Parking Sensor Standard Criteria',
    description:
      'Ultrasonic parking sensor modality, detection range, beam zone, frequency, environmental and electrical criteria.',
    targetProductTypeCodes: ['PARKING_SENSOR'],
    items: [
      requiredComparable('ATTR_PARKING_SENSOR_TYPE', 10),
      optionalComparable('ATTR_ADAS_DETECTION_RANGE_MIN', 20),
      requiredComparable('ATTR_ADAS_DETECTION_RANGE_MAX', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_ADAS_HORIZONTAL_FOV', 40),
      optionalComparable('ATTR_ADAS_VERTICAL_FOV', 50),
      requiredComparable('ATTR_ULTRASONIC_OPERATING_FREQUENCY', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SENSOR_RESPONSE_TIME', 70),
      optionalComparable('ATTR_VOLTAGE', 80),
      optionalComparable('ATTR_IP_RATING', 90),
      requiredComparable('ATTR_PIN_COUNT', 100, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 110),
      optionalComparable('ATTR_MOUNTING_TYPE', 120),
    ],
  },
  {
    code: 'CANON_ADAS_CAMERA_V1',
    name: 'ADAS Camera Standard Criteria',
    description:
      'Front/rear driver-assistance camera resolution, field of view, frame rate, HDR, interface, environmental and calibration criteria.',
    targetProductTypeCodes: ['REAR_VIEW_CAMERA', 'FRONT_CAMERA'],
    items: [
      requiredComparable('ATTR_CAMERA_TYPE', 10),
      requiredComparable('ATTR_CAMERA_RESOLUTION_MEGAPIXELS', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_ADAS_HORIZONTAL_FOV', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_ADAS_VERTICAL_FOV', 40),
      optionalComparable('ATTR_CAMERA_FRAME_RATE', 50),
      optionalComparable('ATTR_CAMERA_HDR', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 80),
      optionalComparable('ATTR_IP_RATING', 90),
      optionalComparable('ATTR_ADAS_CALIBRATION_REQUIRED', 100),
      requiredComparable('ATTR_PIN_COUNT', 110, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 120),
      optionalComparable('ATTR_MOUNTING_TYPE', 130),
    ],
  },
  {
    code: 'CANON_ADAS_RADAR_V1',
    name: 'ADAS Radar Standard Criteria',
    description:
      'Forward/surround/blind-spot radar frequency, range, field of view, update, power, interface and calibration criteria.',
    targetProductTypeCodes: ['RADAR_SENSOR', 'BLIND_SPOT_SENSOR'],
    items: [
      requiredComparable('ATTR_RADAR_TYPE', 10),
      requiredComparable('ATTR_RADAR_OPERATING_FREQUENCY', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_ADAS_DETECTION_RANGE_MAX', 30, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_ADAS_HORIZONTAL_FOV', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_ADAS_VERTICAL_FOV', 50),
      optionalComparable('ATTR_RADAR_UPDATE_TIME', 60),
      optionalComparable('ATTR_VOLTAGE', 70),
      optionalComparable('ATTR_ELECTRICAL_POWER', 80),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 90),
      optionalComparable('ATTR_IP_RATING', 100),
      optionalComparable('ATTR_ADAS_CALIBRATION_REQUIRED', 110),
      requiredComparable('ATTR_PIN_COUNT', 120, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 130),
      optionalComparable('ATTR_MOUNTING_TYPE', 140),
    ],
  },
  {
    code: 'CANON_ENGINE_OIL_V1',
    name: 'Engine Oil Standard Criteria',
    description:
      'Engine-oil viscosity grade, approvals, physical properties and performance chemistry criteria. Vehicle/engine suitability remains structured fitment.',
    targetProductTypeCodes: ['ENGINE_OIL'],
    items: [
      requiredComparable('ATTR_OIL_VISCOSITY', 10, { variantDefining: true }),
      requiredComparable('ATTR_FLUID_BASE_TYPE', 20),
      criterion('ATTR_FLUID_INDUSTRY_STANDARD', 30, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 40, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 50),
      requiredComparable('ATTR_KINEMATIC_VISCOSITY_100C', 60),
      optionalComparable('ATTR_VISCOSITY_INDEX', 70),
      optionalComparable('ATTR_HTHS_VISCOSITY_150C', 80),
      optionalComparable('ATTR_DENSITY_15C', 90),
      optionalComparable('ATTR_FLASH_POINT', 100),
      optionalComparable('ATTR_POUR_POINT', 110),
      optionalComparable('ATTR_TOTAL_BASE_NUMBER', 120),
      optionalComparable('ATTR_SULFATED_ASH_PERCENT', 130),
      optionalComparable('ATTR_PHOSPHORUS_PERCENT', 140),
    ],
  },
  {
    code: 'CANON_ENGINE_FLUSH_V1',
    name: 'Engine Flush Standard Criteria',
    description:
      'Engine-flush formulation, application method, treatment quantity and physical-property criteria.',
    targetProductTypeCodes: ['ENGINE_FLUSH'],
    items: [
      requiredComparable('ATTR_FLUID_BASE_TYPE', 10),
      requiredComparable('ATTR_FLUID_FORMULATION', 20),
      requiredComparable('ATTR_ENGINE_FLUSH_METHOD', 30),
      optionalComparable('ATTR_ENGINE_FLUSH_TREATMENT_VOLUME', 40),
      criterion('ATTR_FLUID_SPECIFICATION', 50),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 60),
      optionalComparable('ATTR_DENSITY_15C', 70),
      optionalComparable('ATTR_FLASH_POINT', 80),
      optionalComparable('ATTR_COLOR', 90),
    ],
  },
  {
    code: 'CANON_AUTOMATIC_TRANSMISSION_FLUID_V1',
    name: 'Automatic Transmission Fluid Standard Criteria',
    description:
      'ATF viscosity, transmission specifications, OEM approvals and physical-property criteria.',
    targetProductTypeCodes: ['AUTOMATIC_TRANSMISSION_FLUID'],
    items: [
      requiredComparable('ATTR_FLUID_TYPE', 10),
      optionalComparable('ATTR_OIL_VISCOSITY', 20),
      criterion('ATTR_TRANSMISSION_FLUID_SPEC', 30, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 40, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 50, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 60),
      requiredComparable('ATTR_KINEMATIC_VISCOSITY_100C', 70),
      optionalComparable('ATTR_VISCOSITY_INDEX', 80),
      optionalComparable('ATTR_DENSITY_15C', 90),
      optionalComparable('ATTR_FLASH_POINT', 100),
      optionalComparable('ATTR_POUR_POINT', 110),
    ],
  },
  {
    code: 'CANON_MANUAL_TRANSMISSION_OIL_V1',
    name: 'Manual Transmission Oil Standard Criteria',
    description:
      'Manual gearbox lubricant viscosity, service class, approvals and physical-property criteria.',
    targetProductTypeCodes: ['MANUAL_TRANSMISSION_OIL'],
    items: [
      requiredComparable('ATTR_GEAR_OIL_VISCOSITY', 10, { variantDefining: true }),
      criterion('ATTR_GEAR_OIL_SERVICE_CLASS', 20, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 30, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 40, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 50),
      requiredComparable('ATTR_KINEMATIC_VISCOSITY_100C', 60),
      optionalComparable('ATTR_VISCOSITY_INDEX', 70),
      optionalComparable('ATTR_DENSITY_15C', 80),
      optionalComparable('ATTR_FLASH_POINT', 90),
      optionalComparable('ATTR_POUR_POINT', 100),
    ],
  },
  {
    code: 'CANON_DIFFERENTIAL_OIL_V1',
    name: 'Differential Oil Standard Criteria',
    description:
      'Differential gear-oil viscosity, service classification, OEM approvals and physical-property criteria.',
    targetProductTypeCodes: ['DIFFERENTIAL_OIL'],
    items: [
      requiredComparable('ATTR_GEAR_OIL_VISCOSITY', 10, { variantDefining: true }),
      requiredComparable('ATTR_GEAR_OIL_SERVICE_CLASS', 20),
      criterion('ATTR_FLUID_SPECIFICATION', 30, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 40, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 50),
      requiredComparable('ATTR_KINEMATIC_VISCOSITY_100C', 60),
      optionalComparable('ATTR_VISCOSITY_INDEX', 70),
      optionalComparable('ATTR_DENSITY_15C', 80),
      optionalComparable('ATTR_FLASH_POINT', 90),
      optionalComparable('ATTR_POUR_POINT', 100),
    ],
  },
  {
    code: 'CANON_TRANSFER_CASE_OIL_V1',
    name: 'Transfer Case Oil Standard Criteria',
    description:
      'Transfer-case fluid viscosity, specification, OEM approval and physical-property criteria.',
    targetProductTypeCodes: ['TRANSFER_CASE_OIL'],
    items: [
      requiredComparable('ATTR_FLUID_TYPE', 10),
      optionalComparable('ATTR_OIL_VISCOSITY', 20),
      criterion('ATTR_TRANSMISSION_FLUID_SPEC', 30, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 40, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 50, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 60),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_100C', 70),
      optionalComparable('ATTR_VISCOSITY_INDEX', 80),
      optionalComparable('ATTR_DENSITY_15C', 90),
      optionalComparable('ATTR_POUR_POINT', 100),
    ],
  },
  {
    code: 'CANON_ANTIFREEZE_COOLANT_V1',
    name: 'Antifreeze / Coolant Standard Criteria',
    description:
      'Coolant chemistry, concentration, formulation, approvals, freeze/boil protection and physical-property criteria.',
    targetProductTypeCodes: ['ANTIFREEZE_COOLANT'],
    items: [
      requiredComparable('ATTR_COOLANT_CHEMISTRY', 10),
      requiredComparable('ATTR_FLUID_FORMULATION', 20),
      optionalComparable('ATTR_COOLANT_CONCENTRATION_PERCENT', 30, {
        variantDefining: true,
      }),
      criterion('ATTR_FLUID_SPECIFICATION', 40, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 50, { filterable: true }),
      requiredComparable('ATTR_FREEZING_POINT', 60),
      optionalComparable('ATTR_BOILING_POINT', 70),
      optionalComparable('ATTR_DENSITY_15C', 80),
      optionalComparable('ATTR_PH_VALUE', 90),
      optionalComparable('ATTR_COLOR', 100),
    ],
  },
  {
    code: 'CANON_BRAKE_FLUID_V1',
    name: 'Brake Fluid Standard Criteria',
    description:
      'Brake-fluid DOT/classification, standards, boiling points, low-temperature viscosity, pH and physical-property criteria.',
    targetProductTypeCodes: ['BRAKE_FLUID'],
    items: [
      requiredComparable('ATTR_BRAKE_FLUID_CLASSIFICATION', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLUID_BASE_TYPE', 20),
      criterion('ATTR_FLUID_INDUSTRY_STANDARD', 30, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 40, { filterable: true }),
      requiredComparable('ATTR_DRY_BOILING_POINT', 50),
      requiredComparable('ATTR_WET_BOILING_POINT', 60),
      requiredComparable('ATTR_FLUID_VISCOSITY_MINUS_40C', 70),
      optionalComparable('ATTR_FLUID_VISCOSITY_100C', 80),
      optionalComparable('ATTR_PH_VALUE', 90),
      optionalComparable('ATTR_DENSITY_15C', 100),
      optionalComparable('ATTR_COLOR', 110),
    ],
  },
  {
    code: 'CANON_POWER_STEERING_FLUID_V1',
    name: 'Power Steering Fluid Standard Criteria',
    description:
      'Power-steering fluid type, approvals, viscosity and low-temperature physical-property criteria.',
    targetProductTypeCodes: ['POWER_STEERING_FLUID'],
    items: [
      requiredComparable('ATTR_FLUID_TYPE', 10),
      requiredComparable('ATTR_FLUID_BASE_TYPE', 20),
      criterion('ATTR_FLUID_SPECIFICATION', 30, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 40, { filterable: true }),
      optionalComparable('ATTR_OIL_VISCOSITY', 50),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 60),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_100C', 70),
      optionalComparable('ATTR_VISCOSITY_INDEX', 80),
      optionalComparable('ATTR_DENSITY_15C', 90),
      optionalComparable('ATTR_FLASH_POINT', 100),
      optionalComparable('ATTR_POUR_POINT', 110),
    ],
  },
  {
    code: 'CANON_HYDRAULIC_FLUID_V1',
    name: 'Hydraulic Fluid Standard Criteria',
    description:
      'Hydraulic fluid viscosity grade, base type, standards, viscosity index and physical-property criteria.',
    targetProductTypeCodes: ['HYDRAULIC_FLUID'],
    items: [
      requiredComparable('ATTR_HYDRAULIC_VISCOSITY_GRADE', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLUID_BASE_TYPE', 20),
      criterion('ATTR_FLUID_INDUSTRY_STANDARD', 30, { filterable: true }),
      criterion('ATTR_FLUID_OEM_APPROVAL', 40, { filterable: true }),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_40C', 50),
      optionalComparable('ATTR_KINEMATIC_VISCOSITY_100C', 60),
      optionalComparable('ATTR_VISCOSITY_INDEX', 70),
      optionalComparable('ATTR_DENSITY_15C', 80),
      optionalComparable('ATTR_FLASH_POINT', 90),
      optionalComparable('ATTR_POUR_POINT', 100),
    ],
  },
  {
    code: 'CANON_CLUTCH_FLUID_V1',
    name: 'Clutch Fluid Standard Criteria',
    description:
      'Hydraulic clutch fluid classification, standards, boiling points, low-temperature viscosity and pH criteria.',
    targetProductTypeCodes: ['CLUTCH_FLUID'],
    items: [
      requiredComparable('ATTR_BRAKE_FLUID_CLASSIFICATION', 10, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_FLUID_BASE_TYPE', 20),
      criterion('ATTR_FLUID_INDUSTRY_STANDARD', 30, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 40, { filterable: true }),
      optionalComparable('ATTR_DRY_BOILING_POINT', 50),
      optionalComparable('ATTR_WET_BOILING_POINT', 60),
      optionalComparable('ATTR_FLUID_VISCOSITY_MINUS_40C', 70),
      optionalComparable('ATTR_PH_VALUE', 80),
    ],
  },
  {
    code: 'CANON_DIESEL_EXHAUST_FLUID_V1',
    name: 'Diesel Exhaust Fluid / AdBlue Standard Criteria',
    description:
      'Diesel exhaust fluid urea concentration, ISO/specification, density, refractive index and freezing-point criteria.',
    targetProductTypeCodes: ['DIESEL_EXHAUST_FLUID'],
    items: [
      requiredComparable('ATTR_UREA_CONCENTRATION_PERCENT', 10, {
        variantDefining: true,
      }),
      criterion('ATTR_FLUID_INDUSTRY_STANDARD', 20, { filterable: true }),
      criterion('ATTR_FLUID_SPECIFICATION', 30, { filterable: true }),
      optionalComparable('ATTR_DENSITY_15C', 40),
      optionalComparable('ATTR_REFRACTIVE_INDEX', 50),
      requiredComparable('ATTR_FREEZING_POINT', 60),
      optionalComparable('ATTR_PH_VALUE', 70),
      optionalComparable('ATTR_COLOR', 80),
    ],
  },
  {
    code: 'CANON_WINDSHIELD_WASHER_FLUID_V1',
    name: 'Windshield Washer Fluid Standard Criteria',
    description:
      'Washer-fluid seasonal/formulation type, freeze protection and basic physical-property criteria.',
    targetProductTypeCodes: ['WINDSHIELD_WASHER_FLUID'],
    items: [
      requiredComparable('ATTR_WASHER_FLUID_TYPE', 10),
      requiredComparable('ATTR_FLUID_FORMULATION', 20),
      requiredComparable('ATTR_FREEZING_POINT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_DENSITY_15C', 40),
      optionalComparable('ATTR_PH_VALUE', 50),
      optionalComparable('ATTR_COLOR', 60),
      criterion('ATTR_FLUID_SPECIFICATION', 70),
    ],
  },
  {
    code: 'CANON_DISTILLED_WATER_V1',
    name: 'Distilled Water Standard Criteria',
    description:
      'Automotive distilled/deionized water purity, conductivity, pH and density criteria.',
    targetProductTypeCodes: ['DISTILLED_WATER'],
    items: [
      optionalComparable('ATTR_WATER_PURITY_PERCENT', 10),
      requiredComparable('ATTR_WATER_CONDUCTIVITY_25C', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PH_VALUE', 30),
      optionalComparable('ATTR_DENSITY_15C', 40),
      criterion('ATTR_FLUID_SPECIFICATION', 50),
    ],
  },

  {
    code: 'CANON_ACCELERATOR_PEDAL_V1',
    name: 'Accelerator Pedal Standard Criteria',
    description:
      'Accelerator pedal architecture, sensor tracks, travel, electrical interface and mounting criteria. Exact vehicle application remains structured fitment.',
    targetProductTypeCodes: ['ACCELERATOR_PEDAL'],
    items: [
      requiredComparable('ATTR_PEDAL_ASSEMBLY_TYPE', 10),
      requiredComparable('ATTR_SENSOR_TYPE', 20),
      optionalComparable('ATTR_SIGNAL_TYPE', 30),
      optionalComparable('ATTR_PEDAL_SENSOR_TRACK_COUNT', 40),
      optionalComparable('ATTR_PEDAL_TRAVEL', 50, { variantDefining: true }),
      optionalComparable('ATTR_PEDAL_ANGLE_RANGE', 60),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MIN', 70),
      optionalComparable('ATTR_SENSOR_OUTPUT_VOLTAGE_MAX', 80),
      optionalComparable('ATTR_VOLTAGE', 90),
      requiredComparable('ATTR_CONNECTOR_GENDER', 100),
      requiredComparable('ATTR_PIN_COUNT', 110, { variantDefining: true }),
      optionalComparable('ATTR_MATERIAL', 120),
      optionalComparable('ATTR_MOUNTING_TYPE', 130),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 140),
    ],
  },
  {
    code: 'CANON_ACCELERATOR_CABLE_V1',
    name: 'Accelerator Cable Standard Criteria',
    description:
      'Accelerator cable total/sheath length, end fittings, adjustment, material and installation-interface criteria.',
    targetProductTypeCodes: ['ACCELERATOR_CABLE'],
    items: [
      requiredComparable('ATTR_CABLE_LENGTH', 10, { variantDefining: true }),
      optionalComparable('ATTR_ACCELERATOR_CABLE_SHEATH_LENGTH', 20, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_ACCELERATOR_CABLE_END_TYPE_1', 30),
      requiredComparable('ATTR_ACCELERATOR_CABLE_END_TYPE_2', 40),
      optionalComparable('ATTR_ACCELERATOR_CABLE_ADJUSTMENT_TYPE', 50),
      optionalComparable('ATTR_MATERIAL', 60),
    ],
  },
  {
    code: 'CANON_CLUTCH_PEDAL_V1',
    name: 'Clutch Pedal Standard Criteria',
    description:
      'Clutch pedal lever/pad geometry, pivot, return spring, material and mounting criteria.',
    targetProductTypeCodes: ['CLUTCH_PEDAL'],
    items: [
      requiredComparable('ATTR_PEDAL_ASSEMBLY_TYPE', 10),
      optionalComparable('ATTR_PEDAL_LEVER_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PEDAL_PAD_WIDTH', 30),
      optionalComparable('ATTR_PEDAL_PAD_HEIGHT', 40),
      optionalComparable('ATTR_PEDAL_PAD_MATERIAL', 50),
      optionalComparable('ATTR_PEDAL_PIVOT_BORE', 60, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_PEDAL_RETURN_SPRING_INCLUDED', 70),
      optionalComparable('ATTR_MATERIAL', 80),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 90),
    ],
  },
  {
    code: 'CANON_BRAKE_PEDAL_SWITCH_V1',
    name: 'Brake Pedal Switch Standard Criteria',
    description:
      'Brake pedal switch contact, actuation, electrical, connector and mounting criteria.',
    targetProductTypeCodes: ['BRAKE_PEDAL_SWITCH'],
    items: [
      requiredComparable('ATTR_SWITCH_TYPE', 10),
      optionalComparable('ATTR_SWITCH_ACTUATION_TRAVEL', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CONTACT_COUNT', 30),
      optionalComparable('ATTR_SWITCH_POSITION_COUNT', 40),
      optionalComparable('ATTR_VOLTAGE', 50),
      optionalComparable('ATTR_CURRENT', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_THREAD_SIZE', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_WINDOW_REGULATOR_V1',
    name: 'Window Regulator Standard Criteria',
    description:
      'Window regulator operation, mechanism, lift envelope, materials, motor inclusion and mounting criteria.',
    targetProductTypeCodes: ['WINDOW_REGULATOR'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_WINDOW_OPERATION_TYPE', 20),
      requiredComparable('ATTR_WINDOW_REGULATOR_TYPE', 30),
      optionalComparable('ATTR_WINDOW_REGULATOR_MAX_LIFT', 40, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WINDOW_REGULATOR_MAX_WIDTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WINDOW_REGULATOR_CABLE_MATERIAL', 60),
      optionalComparable('ATTR_WINDOW_REGULATOR_GEAR_MATERIAL', 70),
      optionalComparable('ATTR_WINDOW_REGULATOR_FRAME_MATERIAL', 80),
      optionalComparable('ATTR_WINDOW_MOTOR_INCLUDED', 90),
      optionalComparable('ATTR_WINDOW_ANTI_PINCH', 100),
      optionalComparable('ATTR_WINDOW_EXPRESS_FUNCTION', 110),
      optionalComparable('ATTR_WINDOW_EMBEDDED_LOGIC', 120),
      optionalComparable('ATTR_WINDOW_MOUNTING_HARDWARE_INCLUDED', 130),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 140),
    ],
  },
  {
    code: 'CANON_WINDOW_MOTOR_V1',
    name: 'Window Lift Motor Standard Criteria',
    description:
      'Window motor electrical rating, rotation, torque, gear, embedded-control and connector criteria.',
    targetProductTypeCodes: ['WINDOW_MOTOR'],
    items: [
      requiredComparable('ATTR_WINDOW_MOTOR_TYPE', 10),
      requiredComparable('ATTR_VOLTAGE', 20, { variantDefining: true }),
      optionalComparable('ATTR_CURRENT', 30),
      optionalComparable('ATTR_WINDOW_MOTOR_TORQUE', 40),
      optionalComparable('ATTR_ROTATION_DIRECTION', 50),
      optionalComparable('ATTR_WINDOW_MOTOR_GEAR_INCLUDED', 60),
      optionalComparable('ATTR_WINDOW_REGULATOR_GEAR_MATERIAL', 70),
      optionalComparable('ATTR_WINDOW_GEAR_TOOTH_COUNT', 80, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WINDOW_GEAR_SPLINE_COUNT', 90),
      optionalComparable('ATTR_WINDOW_ANTI_PINCH', 100),
      optionalComparable('ATTR_WINDOW_EMBEDDED_LOGIC', 110),
      requiredComparable('ATTR_PIN_COUNT', 120, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 130),
      optionalComparable('ATTR_MOUNTING_TYPE', 140),
    ],
  },
  {
    code: 'CANON_WINDOW_CRANK_V1',
    name: 'Window Crank Standard Criteria',
    description:
      'Manual window crank lever, shaft/spline interface, material, grip and appearance criteria.',
    targetProductTypeCodes: ['WINDOW_CRANK'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_WINDOW_CRANK_LENGTH', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WINDOW_GEAR_SPLINE_COUNT', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_WINDOW_CRANK_SHAFT_DIAMETER', 40, {
        variantDefining: true,
      }),
      requiredComparable('ATTR_MATERIAL', 50),
      optionalComparable('ATTR_WINDOW_CRANK_KNOB_MATERIAL', 60),
      optionalComparable('ATTR_COLOR', 70),
    ],
  },
  {
    code: 'CANON_INSTRUMENT_CLUSTER_V1',
    name: 'Instrument Cluster Standard Criteria',
    description:
      'Instrument-cluster display/gauge architecture, scale, illumination, communication, connector and programming criteria.',
    targetProductTypeCodes: ['INSTRUMENT_CLUSTER'],
    items: [
      requiredComparable('ATTR_CLUSTER_DISPLAY_TYPE', 10),
      optionalComparable('ATTR_CLUSTER_DISPLAY_SIZE', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_CLUSTER_GAUGE_COUNT', 30),
      optionalComparable('ATTR_CLUSTER_WARNING_INDICATOR_COUNT', 40),
      optionalComparable('ATTR_CLUSTER_BACKLIGHT_TYPE', 50),
      optionalComparable('ATTR_CLUSTER_ODOMETER_TYPE', 60),
      optionalComparable('ATTR_CLUSTER_ILLUMINATION_COLOR', 70),
      optionalComparable('ATTR_CLUSTER_SPEED_SCALE_MAX', 80),
      optionalComparable('ATTR_CLUSTER_TACHOMETER_SCALE_MAX', 90),
      requiredComparable('ATTR_VOLTAGE', 100),
      requiredComparable('ATTR_CONNECTOR_COUNT', 110),
      requiredComparable('ATTR_PIN_COUNT', 120, { variantDefining: true }),
      optionalComparable('ATTR_COMMUNICATION_PROTOCOL', 130),
      optionalComparable('ATTR_PROGRAMMABLE', 140),
    ],
  },
  {
    code: 'CANON_SPEEDOMETER_SENSOR_V1',
    name: 'Speedometer Sensor Standard Criteria',
    description:
      'Speed sensor technology, signal, pulse rate, electrical interface, cable and mounting criteria.',
    targetProductTypeCodes: ['SPEEDOMETER_SENSOR'],
    items: [
      requiredComparable('ATTR_SENSOR_TYPE', 10),
      optionalComparable('ATTR_SIGNAL_TYPE', 20),
      optionalComparable('ATTR_SPEEDOMETER_PULSES_PER_REVOLUTION', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_VOLTAGE', 40),
      optionalComparable('ATTR_RESISTANCE', 50),
      optionalComparable('ATTR_CABLE_LENGTH', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_THREAD_SIZE', 90),
      optionalComparable('ATTR_MOUNTING_TYPE', 100),
    ],
  },
  {
    code: 'CANON_FUEL_GAUGE_SENDER_V1',
    name: 'Fuel Gauge Sender Standard Criteria',
    description:
      'Fuel-gauge sender sensing type, resistance endpoints, float-arm geometry, signal and connector criteria.',
    targetProductTypeCodes: ['FUEL_GAUGE_SENDER'],
    items: [
      requiredComparable('ATTR_FUEL_LEVEL_SENDER_TYPE', 10),
      optionalComparable('ATTR_FUEL_LEVEL_RESISTANCE_EMPTY', 20, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FUEL_LEVEL_RESISTANCE_FULL', 30, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_FLOAT_ARM_LENGTH', 40),
      optionalComparable('ATTR_SIGNAL_TYPE', 50),
      optionalComparable('ATTR_VOLTAGE', 60),
      requiredComparable('ATTR_PIN_COUNT', 70, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 80),
      optionalComparable('ATTR_MOUNTING_TYPE', 90),
    ],
  },
  {
    code: 'CANON_SEAT_ADJUSTER_V1',
    name: 'Seat Adjuster Standard Criteria',
    description:
      'Seat adjuster architecture, axis/motor count, track/travel geometry, memory and electrical criteria.',
    targetProductTypeCodes: ['SEAT_ADJUSTER'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_SEAT_ADJUSTER_TYPE', 20),
      requiredComparable('ATTR_SEAT_ADJUSTMENT_AXIS_COUNT', 30),
      optionalComparable('ATTR_SEAT_MOTOR_COUNT', 40),
      optionalComparable('ATTR_SEAT_TRACK_LENGTH', 50, {
        variantDefining: true,
      }),
      optionalComparable('ATTR_SEAT_TRAVEL', 60),
      optionalComparable('ATTR_SEAT_MEMORY_SUPPORTED', 70),
      optionalComparable('ATTR_VOLTAGE', 80),
      optionalComparable('ATTR_CONNECTOR_COUNT', 90),
      optionalComparable('ATTR_PIN_COUNT', 100),
      optionalComparable('ATTR_MATERIAL', 110),
    ],
  },
  {
    code: 'CANON_SEAT_SWITCH_V1',
    name: 'Seat Switch Standard Criteria',
    description:
      'Power-seat switch actuator count, illumination, switch/circuit count, electrical interface and mounting criteria.',
    targetProductTypeCodes: ['SEAT_SWITCH'],
    items: [
      optionalComparable('ATTR_SIDE', 10),
      requiredComparable('ATTR_SWITCH_TYPE', 20),
      requiredComparable('ATTR_SEAT_SWITCH_QUANTITY', 30),
      optionalComparable('ATTR_SWITCH_POSITION_COUNT', 40),
      optionalComparable('ATTR_CIRCUIT_COUNT', 50),
      optionalComparable('ATTR_SEAT_SWITCH_ILLUMINATED', 60),
      optionalComparable('ATTR_SEAT_MEMORY_SUPPORTED', 70),
      optionalComparable('ATTR_VOLTAGE', 80),
      requiredComparable('ATTR_CONNECTOR_COUNT', 90),
      requiredComparable('ATTR_PIN_COUNT', 100, { variantDefining: true }),
      optionalComparable('ATTR_CONNECTOR_GENDER', 110),
      optionalComparable('ATTR_MOUNTING_TYPE', 120),
      optionalComparable('ATTR_COLOR', 130),
    ],
  },
  {
    code: 'CANON_INTERIOR_LATCH_V1',
    name: 'Interior Storage Latch Standard Criteria',
    description:
      'Glove-box and center-console latch construction, locking, key cylinder, cable/sensor, material and mounting criteria.',
    targetProductTypeCodes: ['GLOVE_BOX_LATCH', 'CENTER_CONSOLE_LATCH'],
    items: [
      requiredComparable('ATTR_INTERIOR_LATCH_TYPE', 10),
      optionalComparable('ATTR_INTERIOR_LATCH_LOCKABLE', 20),
      optionalComparable('ATTR_INTERIOR_LATCH_KEY_CYLINDER_INCLUDED', 30),
      optionalComparable('ATTR_LATCH_CABLE_INCLUDED', 40),
      optionalComparable('ATTR_LATCH_POSITION_SENSOR', 50),
      requiredComparable('ATTR_MATERIAL', 60),
      optionalComparable('ATTR_MOUNTING_TYPE', 70),
      optionalComparable('ATTR_MOUNTING_HOLE_COUNT', 80),
      optionalComparable('ATTR_COLOR', 90),
    ],
  },

] as const;

export function validateCanonicalCriteriaTemplateLibrary(): string[] {
  const errors: string[] = [];
  const attributeCodes = new Set(
    MASTER_ATTRIBUTE_LIBRARY.attributes.map((attribute) => attribute.code),
  );
  const templateCodes = new Set<string>();
  const productTypeTargetOwners = new Map<string, string>();

  for (const template of CANONICAL_AUTOMOTIVE_CRITERIA_TEMPLATES) {
    if (templateCodes.has(template.code)) {
      errors.push(`Duplicate Criteria Template code: ${template.code}`);
    }
    templateCodes.add(template.code);

    if (template.targetProductTypeCodes.length === 0) {
      errors.push(`Criteria Template ${template.code} has no Product Type targets`);
    }

    const targetCodes = new Set<string>();
    for (const productTypeCode of template.targetProductTypeCodes) {
      if (targetCodes.has(productTypeCode)) {
        errors.push(
          `Criteria Template ${template.code} repeats Product Type target ${productTypeCode}`,
        );
      }
      targetCodes.add(productTypeCode);
      const existingOwner = productTypeTargetOwners.get(productTypeCode);
      if (existingOwner) {
        errors.push(
          `Product Type ${productTypeCode} is targeted by both ${existingOwner} and ${template.code}`,
        );
      } else {
        productTypeTargetOwners.set(productTypeCode, template.code);
      }
    }

    const itemCodes = new Set<string>();
    let previousOrder = -1;
    for (const item of template.items) {
      if (!attributeCodes.has(item.attributeCode)) {
        errors.push(
          `Criteria Template ${template.code} references missing Attribute ${item.attributeCode}`,
        );
      }
      if (itemCodes.has(item.attributeCode)) {
        errors.push(
          `Criteria Template ${template.code} repeats Attribute ${item.attributeCode}`,
        );
      }
      itemCodes.add(item.attributeCode);

      if (item.displayOrder < previousOrder) {
        errors.push(
          `Criteria Template ${template.code} has non-monotonic display order`,
        );
      }
      previousOrder = item.displayOrder;
    }
  }

  return errors;
}

export const CANONICAL_CRITERIA_TEMPLATE_LIBRARY_VALIDATION =
  validateCanonicalCriteriaTemplateLibrary();
