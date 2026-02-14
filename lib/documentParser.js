/**
 * DocumentParser - Extract text from various document formats
 * Supports: PDF, DOCX, plain text
 */

export class DocumentParser {
  /**
   * Parse any document file
   * @param {File} file - The document file
   * @returns {Promise<string>} Extracted text
   */
  static async parse(file) {
    const type = file.type;

    if (type === 'application/pdf') {
      return this.parsePDF(file);
    } else if (
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      type === 'application/msword'
    ) {
      return this.parseDOCX(file);
    } else if (type === 'text/plain' || file.name.endsWith('.txt')) {
      return this.parseText(file);
    } else {
      throw new Error(`Unsupported file type: ${type}`);
    }
  }

  /**
   * Parse a PDF file
   * Note: Requires PDF.js library to be loaded globally as pdfjsLib
   * @param {File} file - PDF file
   * @returns {Promise<string>} Extracted text
   */
  static async parsePDF(file) {
    try {
      // Check if PDF.js is available
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded. Please install and load PDF.js worker.');
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        text += pageText + '\n';
      }

      return text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse a DOCX file
   * Note: DOCX is a ZIP file containing XML
   * @param {File} file - DOCX file
   * @returns {Promise<string>} Extracted text
   */
  static async parseDOCX(file) {
    try {
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded. Please install and load JSZip.');
      }

      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      
      // Get the main document XML
      const xmlFile = zipData.file('word/document.xml');
      if (!xmlFile) {
        throw new Error('Invalid DOCX file: document.xml not found');
      }

      const xmlContent = await xmlFile.async('string');
      
      // Parse XML and extract text from <w:t> tags
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      const textElements = xmlDoc.getElementsByTagName('w:t');
      let text = '';
      
      for (let element of textElements) {
        text += element.textContent;
      }

      return text;
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  /**
   * Parse a plain text file
   * @param {File} file - Text file
   * @returns {Promise<string>} File content
   */
  static async parseText(file) {
    try {
      return await file.text();
    } catch (error) {
      throw new Error(`Text parsing failed: ${error.message}`);
    }
  }

  /**
   * Split text into sections based on common resume structure
   * @param {string} text - Full document text
   * @returns {Object} Organized sections
   */
  static extractSections(text) {
    const sections = {
      personal: '',
      summary: '',
      experience: '',
      education: '',
      skills: '',
      projects: '',
      certifications: '',
      other: ''
    };

    // Common section headers (case-insensitive)
    const sectionPatterns = {
      personal: /^(contact|personal|header|profile info)/mi,
      summary: /^(professional summary|summary|objective)/mi,
      experience: /^(experience|work experience|employment|professional experience)/mi,
      education: /^(education|academic|degrees)/mi,
      skills: /^(skills|technical skills|core competencies|expertise)/mi,
      projects: /^(projects|portfolio|key projects)/mi,
      certifications: /^(certifications|certifications & licenses|credentials)/mi
    };

    // Split by common section headers
    const lines = text.split('\n');
    let currentSection = 'other';
    let currentContent = [];

    for (const line of lines) {
      let foundSection = false;

      for (const [section, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(line)) {
          // Save previous section
          if (currentContent.length > 0) {
            sections[currentSection] += currentContent.join('\n') + '\n';
          }
          // Start new section
          currentSection = section;
          currentContent = [];
          foundSection = true;
          break;
        }
      }

      if (!foundSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      sections[currentSection] += currentContent.join('\n');
    }

    return sections;
  }

  /**
   * Clean and normalize extracted text
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  static cleanText(text) {
    return text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[^\w\s\-.,;:()']/g, '')  // Remove special characters
      .trim();
  }
}
