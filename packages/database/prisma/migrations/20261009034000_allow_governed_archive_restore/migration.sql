-- Align the core database guard with the audited Restore endpoint.
-- Restore returns an archived record to DEPRECATED, never directly to ACTIVE.
-- Do not edit an applied migration or weaken any other transition.

CREATE OR REPLACE FUNCTION "enforce_core_master_data_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN
      RAISE EXCEPTION
        'Core master data must be created as DRAFT or ACTIVE, not %',
        NEW."status"
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'DRAFT'
     AND NEW."status" IN ('ACTIVE', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'ACTIVE'
     AND NEW."status" IN ('DEPRECATED', 'SUPERSEDED', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'DEPRECATED'
     AND NEW."status" IN ('ACTIVE', 'SUPERSEDED', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'SUPERSEDED'
     AND NEW."status" = 'ARCHIVED' THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'INACTIVE'
     AND NEW."status" IN ('ACTIVE', 'DEPRECATED', 'ARCHIVED') THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'ARCHIVED'
     AND NEW."status" = 'DEPRECATED' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Invalid core master-data lifecycle transition % -> % on %',
    OLD."status", NEW."status", TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
