(function initAutoFillGraphV5Schema(root) {
  "use strict";

  const Sensitivity = Object.freeze({
    PUBLIC: "PUBLIC", RESTRICTED: "RESTRICTED", ENCRYPTED: "ENCRYPTED"
  });

  const FillStatus = Object.freeze({
    FILLED: "FILLED", INFERRED: "INFERRED", GENERATED: "GENERATED",
    UNKNOWN: "UNKNOWN", IMAGE_FILLED: "IMAGE_FILLED", NOT_APPLICABLE: "NOT_APPLICABLE"
  });

  const Route = Object.freeze({
    LOCAL: "local", COMPOSITIONAL: "compositional", INFERENCE: "inference",
    RETRIEVAL_LLM: "retrieval_llm", LLM_SMALL: "llm_small", LLM_LARGE: "llm_large",
    DOMAIN_GUARD: "domain_guard", IMAGE: "image"
  });

  const FeedbackAction = Object.freeze({
    ACCEPT: "accept", REJECT: "reject", CORRECT: "correct"
  });

  const EntityType = Object.freeze({
    PERSON: "Person", ORGANIZATION: "Organization",
    LOCATION: "Location", CREDENTIAL: "Credential",
    ROLE: "Role", INTEREST: "Interest", DOCUMENT: "Document"
  });

  const RelationType = Object.freeze({
    STUDIED_AT: "STUDIED_AT", EMPLOYED_AT: "EMPLOYED_AT",
    AFFILIATED_WITH: "AFFILIATED_WITH", LOCATED_IN: "LOCATED_IN",
    USES_SKILL: "USES_SKILL", HAS_CREDENTIAL: "HAS_CREDENTIAL"
  });

  // ── Layers ──────────────────────────────────────────────────────────────────

  const LAYER_DEFINITIONS = Object.freeze({
    identity: {
      sensitivity: Sensitivity.PUBLIC,
      properties: ["full_name", "first_name", "last_name", "display_name", "aliases"]
    },
    contact: {
      sensitivity: Sensitivity.PUBLIC,
      properties: [
        "email", "work_email", "phone", "address", "city", "state",
        "region", "zip_code", "country", "linkedin", "portfolio"
      ]
    },
    academic: {
      sensitivity: Sensitivity.PUBLIC,
      properties: [
        "university", "department", "degree", "gpa", "graduation_date",
        "thesis", "advisor", "research_interests"
      ]
    },
    professional: {
      sensitivity: Sensitivity.PUBLIC,
      properties: [
        "employer", "job_title", "skills", "years_experience",
        "resume", "bio", "research_statement"
      ]
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
      properties: [
        "profile_photo", "signature", "resume_scan",
        "transcript_scan", "id_scan", "passport_scan"
      ]
    }
  });

  // ── Property definitions (v5 — adds research_interests, research_statement) ──

  const PROPERTY_DEFINITIONS = Object.freeze({
    full_name: {
      description: "The user's complete legal or preferred full name.",
      aliases: ["full name", "name", "legal name", "candidate name", "applicant name",
                "your name", "employee name"]
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
      aliases: ["alias", "other names", "known as"]
    },
    email: {
      description: "The user's primary email address for contact.",
      aliases: [
        "email", "e-mail", "email address", "contact email", "electronic mail",
        "primary electronic mail", "digital inbox", "how should we reach you digitally"
      ]
    },
    work_email: {
      description: "The user's work or institutional email address.",
      aliases: ["work email", "business email", "institutional email", "official email",
                "digital inbox for official correspondence"]
    },
    phone: {
      description: "The user's phone or mobile contact number.",
      aliases: ["phone", "telephone", "phone number", "mobile", "cell",
                "contact number", "mobile number"]
    },
    address: {
      description: "The user's street or mailing address.",
      aliases: ["address", "street address", "mailing address", "home address",
                "residential address", "current address"]
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
      description: "The region, state, or administrative area.",
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
      aliases: ["portfolio", "website", "personal website", "github", "portfolio url",
                "where can we see your work", "public code repository or project page"]
    },
    university: {
      description: "The user's university, college, school, or academic institution.",
      aliases: ["university", "school", "college", "institution", "alma mater",
                "university name", "institution name"]
    },
    department: {
      description: "The user's academic department or field of study.",
      aliases: ["department", "academic department", "program department",
                "field inferred from your program", "field of study"]
    },
    degree: {
      description: "The user's degree, program, major, or academic qualification.",
      aliases: ["degree", "program", "major", "qualification", "degree program",
                "field of study", "area of study"]
    },
    gpa: {
      description: "The user's grade point average or academic score.",
      aliases: ["gpa", "grade point average", "cgpa", "cumulative gpa", "academic score",
                "cumulative academic score", "quantitative measure of academic performance",
                "numerical academic performance indicator", "academic performance"]
    },
    graduation_date: {
      description: "The user's graduation or completion date.",
      aliases: ["graduation date", "grad date", "completion date", "expected graduation",
                "expected graduation date"]
    },
    thesis: {
      description: "The user's thesis, dissertation, or research topic.",
      aliases: ["thesis", "dissertation", "research topic", "thesis title"]
    },
    advisor: {
      description: "The user's advisor, supervisor, or faculty advisor.",
      aliases: ["advisor", "supervisor", "thesis advisor", "faculty advisor",
                "who supervises your research", "faculty mentor supervising thesis work",
                "academic advisor"]
    },
    research_interests: {
      description: "The user's research interests, focus areas, and academic pursuits.",
      aliases: ["research interests", "research focus", "areas of interest",
                "academic interests", "research areas"]
    },
    employer: {
      description: "The user's current employer, company, or workplace.",
      aliases: ["employer", "company", "organization", "workplace", "current employer"]
    },
    job_title: {
      description: "The user's job title, position, role, or designation.",
      aliases: ["job title", "title", "position", "role", "designation",
                "your role in one line"]
    },
    skills: {
      description: "The user's technical skills, abilities, competencies, or tools.",
      aliases: ["skills", "technical skills", "expertise", "competencies", "technologies",
                "what tools can you use", "tools and skills"]
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
      aliases: ["bio", "biography", "about", "summary", "profile", "personal statement",
                "professional summary", "career summary"]
    },
    research_statement: {
      description: "The user's research statement, statement of purpose, or academic narrative.",
      aliases: [
        "research statement", "statement of purpose", "research narrative",
        "academic statement", "sop", "personal statement of research"
      ]
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
      aliases: ["visa status", "immigration status", "current visa",
                "immigration authorization category"]
    },
    drivers_license: {
      description: "The user's driver's license number.",
      aliases: ["drivers license", "driver license", "license number",
                "driver license number"]
    },
    citizenship: {
      description: "The user's citizenship or nationality.",
      aliases: ["citizenship", "citizen of", "nationality"]
    },
    profile_photo: {
      description: "The user's profile photo or headshot.",
      aliases: ["profile photo", "headshot", "photo", "profile picture", "portrait"]
    },
    signature: {
      description: "The user's signature image.",
      aliases: ["signature", "sign here", "upload signature",
                "scanned handwritten approval mark"]
    },
    resume_scan: {
      description: "A scanned resume or CV document.",
      aliases: ["resume scan", "cv upload", "upload resume"]
    },
    transcript_scan: {
      description: "A scanned academic transcript.",
      aliases: ["transcript", "academic transcript", "upload transcript", "grade report"]
    },
    id_scan: {
      description: "A scanned identification document.",
      aliases: ["id scan", "identity document", "government id", "id upload"]
    },
    passport_scan: {
      description: "A scanned passport document.",
      aliases: ["passport scan", "passport upload", "copy of passport"]
    }
  });

  // ── Domain property groups ───────────────────────────────────────────────────

  const DOMAIN_PROPERTIES = Object.freeze({
    medical: ["allergies", "blood_type", "insurance_id", "conditions", "medications", "primary_care"],
    financial: ["ssn", "tax_id", "bank_name", "annual_income", "credit_score"],
    legal: ["passport_number", "visa_status", "drivers_license", "citizenship"],
    academic: ["university", "department", "degree", "gpa", "graduation_date", "thesis",
               "advisor", "research_interests"],
    professional: ["employer", "job_title", "skills", "years_experience", "resume", "bio",
                   "research_statement"],
    contact: ["email", "work_email", "phone", "address", "city", "state", "region",
              "zip_code", "country"],
    document: ["profile_photo", "signature", "resume_scan", "transcript_scan",
               "id_scan", "passport_scan"]
  });

  // ── Composite field definitions ──────────────────────────────────────────────

  const COMPOSITE_DEFINITIONS = Object.freeze({
    full_address: ["address", "city", "state", "zip_code"],
    residential_address: ["address", "city", "state", "zip_code", "country"],
    location: ["city", "state", "region", "country"],
    academic_info: ["university", "department", "degree"],
    contact_info: ["email", "phone"],
    professional_profile: ["employer", "job_title", "years_experience"]
  });

  // ── Image categories ─────────────────────────────────────────────────────────

  const IMAGE_CATEGORIES = Object.freeze({
    profile_photo: ["photo", "headshot", "profile picture", "portrait"],
    signature: ["signature", "sign", "signed", "approval mark"],
    transcript_scan: ["transcript", "grade report", "academic record"],
    id_scan: ["id", "identity", "government id", "license"],
    passport_scan: ["passport"],
    resume_scan: ["resume", "cv", "curriculum vitae"]
  });

  // ── Domain sensitivity limits ────────────────────────────────────────────────

  const DOMAIN_MAX_SENSITIVITY = Object.freeze({
    visa: Sensitivity.ENCRYPTED, legal: Sensitivity.ENCRYPTED,
    medical: Sensitivity.RESTRICTED, financial: Sensitivity.RESTRICTED,
    document: Sensitivity.RESTRICTED
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getLayerForProperty(property) {
    for (const [layer, def] of Object.entries(LAYER_DEFINITIONS)) {
      if (def.properties.includes(property)) return layer;
    }
    return "identity";
  }

  function getSensitivityForProperty(property) {
    const layer = getLayerForProperty(property);
    return LAYER_DEFINITIONS[layer]?.sensitivity || Sensitivity.PUBLIC;
  }

  function buildPropLayer() {
    const m = {};
    for (const [layer, def] of Object.entries(LAYER_DEFINITIONS)) {
      for (const p of def.properties) m[p] = layer;
    }
    return Object.freeze(m);
  }

  const PROP_LAYER = buildPropLayer();

  const api = Object.freeze({
    Sensitivity, FillStatus, Route, FeedbackAction, EntityType, RelationType,
    LAYER_DEFINITIONS, PROPERTY_DEFINITIONS, DOMAIN_PROPERTIES,
    COMPOSITE_DEFINITIONS, IMAGE_CATEGORIES, DOMAIN_MAX_SENSITIVITY, PROP_LAYER,
    getLayerForProperty, getSensitivityForProperty
  });

  root.AutoFillGraphV5Schema = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
