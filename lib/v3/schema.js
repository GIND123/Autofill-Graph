(function initAutoFillGraphV3Schema(root) {
  "use strict";

  const EntityType = Object.freeze({
    PERSON: "PERSON",
    ORGANIZATION: "ORGANIZATION",
    LOCATION: "LOCATION",
    CREDENTIAL: "CREDENTIAL",
    ROLE: "ROLE",
    INTEREST: "INTEREST",
    DOCUMENT: "DOCUMENT"
  });

  const Sensitivity = Object.freeze({
    PUBLIC: "PUBLIC",
    RESTRICTED: "RESTRICTED",
    ENCRYPTED: "ENCRYPTED"
  });

  const FillStatus = Object.freeze({
    FILLED: "FILLED",
    INFERRED: "INFERRED",
    GENERATED: "GENERATED",
    UNKNOWN: "UNKNOWN",
    IMAGE_FILLED: "IMAGE_FILLED",
    NOT_APPLICABLE: "NOT_APPLICABLE"
  });

  const Route = Object.freeze({
    LOCAL: "local",
    COMPOSITIONAL: "compositional",
    INFERENCE: "inference",
    RETRIEVAL_LLM: "retrieval_llm",
    LLM_SMALL: "llm_small",
    LLM_LARGE: "llm_large",
    DOMAIN_GUARD: "domain_guard",
    IMAGE: "image"
  });

  const FeedbackAction = Object.freeze({
    ACCEPT: "accept",
    REJECT: "reject",
    CORRECT: "correct"
  });

  const RelationType = Object.freeze({
    AFFILIATED_WITH: "AFFILIATED_WITH",
    INTERESTED_IN: "INTERESTED_IN",
    STUDIED_AT: "STUDIED_AT",
    WORKED_AT: "WORKED_AT",
    HAS_CREDENTIAL: "HAS_CREDENTIAL",
    HAS_ROLE: "HAS_ROLE",
    LOCATED_IN: "LOCATED_IN",
    USES_SKILL: "USES_SKILL"
  });

  const LAYER_DEFINITIONS = Object.freeze({
    identity: {
      sensitivity: Sensitivity.PUBLIC,
      properties: ["full_name", "first_name", "last_name", "display_name", "aliases"]
    },
    contact: {
      sensitivity: Sensitivity.PUBLIC,
      properties: [
        "email",
        "work_email",
        "phone",
        "address",
        "city",
        "state",
        "region",
        "zip_code",
        "country",
        "linkedin",
        "portfolio"
      ]
    },
    academic: {
      sensitivity: Sensitivity.PUBLIC,
      properties: [
        "university",
        "department",
        "degree",
        "gpa",
        "graduation_date",
        "thesis",
        "advisor"
      ]
    },
    professional: {
      sensitivity: Sensitivity.PUBLIC,
      properties: ["employer", "job_title", "skills", "years_experience", "resume", "bio"]
    },
    medical: {
      sensitivity: Sensitivity.RESTRICTED,
      properties: ["allergies", "blood_type", "insurance_id", "conditions", "medications", "primary_care"]
    },
    financial: {
      sensitivity: Sensitivity.RESTRICTED,
      properties: ["ssn", "tax_id", "bank_name", "annual_income", "credit_score"]
    },
    legal: {
      sensitivity: Sensitivity.ENCRYPTED,
      properties: ["passport_number", "visa_status", "drivers_license", "citizenship"]
    },
    document: {
      sensitivity: Sensitivity.RESTRICTED,
      properties: ["profile_photo", "signature", "resume_scan", "transcript_scan", "id_scan", "passport_scan"]
    }
  });

  const PROPERTY_DEFINITIONS = Object.freeze({
    full_name: {
      description: "The user's complete legal or preferred full name.",
      aliases: ["full name", "name", "legal name", "candidate name", "applicant name", "your name"]
    },
    first_name: {
      description: "The user's given name or first name.",
      aliases: ["first name", "given name", "forename", "fname"]
    },
    last_name: {
      description: "The user's family name or surname.",
      aliases: ["last name", "surname", "family name", "lname"]
    },
    display_name: {
      description: "The user's display name or preferred public name.",
      aliases: ["display name", "preferred name", "public name"]
    },
    aliases: {
      description: "Other names or aliases used by the user.",
      aliases: ["alias", "aliases", "other names"]
    },
    email: {
      description: "The user's primary email address for contact.",
      aliases: ["email", "e-mail", "email address", "contact email", "electronic mail"]
    },
    work_email: {
      description: "The user's work or institutional email address.",
      aliases: ["work email", "business email", "institutional email"]
    },
    phone: {
      description: "The user's phone or mobile contact number.",
      aliases: ["phone", "telephone", "phone number", "mobile", "cell", "contact number"]
    },
    address: {
      description: "The user's street or mailing address.",
      aliases: ["address", "street address", "mailing address", "home address", "residential address"]
    },
    city: {
      description: "The city where the user lives or is located.",
      aliases: ["city", "town", "municipality"]
    },
    state: {
      description: "The state or province where the user lives.",
      aliases: ["state", "province", "territory"]
    },
    region: {
      description: "The region, state, or administrative area for the user.",
      aliases: ["region", "state/region", "state or region"]
    },
    zip_code: {
      description: "The user's ZIP code or postal code.",
      aliases: ["zip", "zip code", "postal code", "postcode", "pin code"]
    },
    country: {
      description: "The country where the user lives or is located.",
      aliases: ["country", "nation", "country of residence"]
    },
    linkedin: {
      description: "The user's LinkedIn profile URL or handle.",
      aliases: ["linkedin", "linkedin profile", "linkedin url"]
    },
    portfolio: {
      description: "The user's portfolio, website, GitHub, or personal site URL.",
      aliases: ["portfolio", "website", "personal website", "github", "portfolio url"]
    },
    university: {
      description: "The user's university, college, school, or academic institution.",
      aliases: ["university", "school", "college", "institution", "alma mater"]
    },
    department: {
      description: "The user's academic department or field.",
      aliases: ["department", "academic department", "program department"]
    },
    degree: {
      description: "The user's degree, program, major, or academic qualification.",
      aliases: ["degree", "program", "major", "qualification", "field of study"]
    },
    gpa: {
      description: "The user's grade point average or academic score.",
      aliases: ["gpa", "grade point average", "cgpa", "cumulative gpa", "academic score"]
    },
    graduation_date: {
      description: "The user's graduation or completion date.",
      aliases: ["graduation date", "grad date", "completion date", "expected graduation"]
    },
    thesis: {
      description: "The user's thesis, dissertation, or research topic.",
      aliases: ["thesis", "dissertation", "research topic", "thesis title"]
    },
    advisor: {
      description: "The user's advisor, supervisor, or faculty advisor.",
      aliases: ["advisor", "supervisor", "thesis advisor", "faculty advisor"]
    },
    employer: {
      description: "The user's current employer, company, or workplace.",
      aliases: ["employer", "company", "organization", "workplace", "current employer"]
    },
    job_title: {
      description: "The user's job title, position, role, or designation.",
      aliases: ["job title", "title", "position", "role", "designation"]
    },
    skills: {
      description: "The user's technical skills, abilities, competencies, or tools.",
      aliases: ["skills", "technical skills", "expertise", "competencies", "technologies"]
    },
    years_experience: {
      description: "The user's years of professional experience.",
      aliases: ["years of experience", "experience", "work experience", "total experience"]
    },
    resume: {
      description: "The user's resume or CV text.",
      aliases: ["resume", "cv", "curriculum vitae"]
    },
    bio: {
      description: "The user's biography, profile, summary, or personal statement.",
      aliases: ["bio", "biography", "about", "summary", "profile", "personal statement"]
    },
    allergies: {
      description: "The user's allergies.",
      aliases: ["allergies", "known allergies", "allergy"]
    },
    blood_type: {
      description: "The user's blood type.",
      aliases: ["blood type", "blood group"]
    },
    insurance_id: {
      description: "The user's health insurance identifier.",
      aliases: ["insurance id", "insurance number", "policy number", "member id"]
    },
    conditions: {
      description: "The user's medical conditions.",
      aliases: ["conditions", "medical conditions", "diagnoses"]
    },
    medications: {
      description: "The user's medications.",
      aliases: ["medications", "medicine", "current medications"]
    },
    primary_care: {
      description: "The user's primary care physician or clinic.",
      aliases: ["primary care", "primary doctor", "pcp"]
    },
    ssn: {
      description: "The user's social security number.",
      aliases: ["ssn", "social security", "social security number"]
    },
    tax_id: {
      description: "The user's tax identifier.",
      aliases: ["tax id", "tin", "tax identification number"]
    },
    bank_name: {
      description: "The user's bank name.",
      aliases: ["bank", "bank name", "financial institution"]
    },
    annual_income: {
      description: "The user's annual income.",
      aliases: ["annual income", "income", "yearly income", "salary"]
    },
    credit_score: {
      description: "The user's credit score.",
      aliases: ["credit score", "fico score"]
    },
    passport_number: {
      description: "The user's passport number.",
      aliases: ["passport number", "passport no", "passport"]
    },
    visa_status: {
      description: "The user's visa or immigration status.",
      aliases: ["visa status", "immigration status", "current visa"]
    },
    drivers_license: {
      description: "The user's driver's license number.",
      aliases: ["drivers license", "driver license", "license number"]
    },
    citizenship: {
      description: "The user's citizenship, only from explicit user-provided data.",
      aliases: ["citizenship", "citizen of", "nationality"]
    },
    profile_photo: {
      description: "The user's profile photo or headshot.",
      aliases: ["profile photo", "headshot", "photo"]
    },
    signature: {
      description: "The user's signature image.",
      aliases: ["signature", "sign here", "upload signature"]
    },
    resume_scan: {
      description: "A scanned resume or CV document.",
      aliases: ["resume scan", "cv upload", "upload resume"]
    },
    transcript_scan: {
      description: "A scanned academic transcript.",
      aliases: ["transcript", "academic transcript", "upload transcript"]
    },
    id_scan: {
      description: "A scanned identification document.",
      aliases: ["id scan", "identity document", "government id"]
    },
    passport_scan: {
      description: "A scanned passport document.",
      aliases: ["passport scan", "passport upload", "copy of passport"]
    }
  });

  const DOMAIN_PROPERTIES = Object.freeze({
    medical: ["allergies", "blood_type", "insurance_id", "conditions", "medications", "primary_care"],
    financial: ["ssn", "tax_id", "bank_name", "annual_income", "credit_score"],
    legal: ["passport_number", "visa_status", "drivers_license", "citizenship"],
    academic: ["university", "department", "degree", "gpa", "graduation_date", "thesis", "advisor"],
    professional: ["employer", "job_title", "skills", "years_experience", "resume", "bio"],
    contact: ["email", "work_email", "phone", "address", "city", "state", "region", "zip_code", "country"]
  });

  const COMPOSITE_DEFINITIONS = Object.freeze({
    full_address: ["address", "city", "state", "zip_code", "country"],
    residential_address: ["address", "city", "state", "zip_code", "country"],
    location: ["city", "state", "region", "country"],
    academic_info: ["university", "department", "degree"],
    contact_info: ["email", "phone"],
    professional_profile: ["employer", "job_title", "years_experience"]
  });

  const IMAGE_CATEGORIES = Object.freeze({
    profile_photo: ["photo", "headshot", "profile picture", "portrait"],
    signature: ["signature", "sign", "signed"],
    transcript_scan: ["transcript", "grade report", "academic record"],
    id_scan: ["id", "identity", "government id", "license"],
    passport_scan: ["passport"],
    resume_scan: ["resume", "cv", "curriculum vitae"]
  });

  function getLayerForProperty(property) {
    for (const [layer, definition] of Object.entries(LAYER_DEFINITIONS)) {
      if (definition.properties.includes(property)) return layer;
    }
    return "identity";
  }

  function getSensitivityForProperty(property) {
    const layer = getLayerForProperty(property);
    return LAYER_DEFINITIONS[layer]?.sensitivity || Sensitivity.PUBLIC;
  }

  const api = Object.freeze({
    EntityType,
    Sensitivity,
    FillStatus,
    Route,
    FeedbackAction,
    RelationType,
    LAYER_DEFINITIONS,
    PROPERTY_DEFINITIONS,
    DOMAIN_PROPERTIES,
    COMPOSITE_DEFINITIONS,
    IMAGE_CATEGORIES,
    getLayerForProperty,
    getSensitivityForProperty
  });

  root.AutoFillGraphV3Schema = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
