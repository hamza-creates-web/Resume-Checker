const express = require('express');
const multer = require('multer');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for memory storage (to access buffer directly)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Upload route
app.post('/upload', upload.single('resume'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Get Gemini model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Convert PDF buffer to base64
        const pdfPart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: "application/pdf"
            }
        };

        // Create strict prompt for resume analysis
        const prompt = `Analyze the provided resume and return ONLY a valid JSON object with this exact structure. Do not include any markdown, backticks, or introductory text:

{
  "ats_score": <number 0-100>,
  "skills": [<array of 5-8 technical and soft skills found>],
  "improvements": [<array of 4-5 specific improvement suggestions>],
  "matched_jobs": [<array of 4-5 job titles matching the skills>],
  "missing_keywords": [<array of 5-7 industry keywords to add>],
  "interview_prep": [
    {"question": "<tough question 1>", "suggested_answer": "<concise answer tip>"},
    {"question": "<tough question 2>", "suggested_answer": "<concise answer tip>"},
    {"question": "<tough question 3>", "suggested_answer": "<concise answer tip>"},
    {"question": "<tough question 4>", "suggested_answer": "<concise answer tip>"}
  ]
}

IMPORTANT: 
- Ensure ALL fields are present and populated
- skills, matched_jobs, missing_keywords must each have at least 4 items
- interview_prep must have exactly 4 question-answer pairs
- All strings must be meaningful and specific to the resume content
- Return ONLY the JSON object, nothing else`;

        // Send to Gemini with PDF
        const result = await model.generateContent([prompt, pdfPart]);
        const response = result.response.text();

        // Parse the AI response
        let analysis;
        try {
            // Try to extract JSON from response (in case it has extra text)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const jsonStr = jsonMatch[0];
            analysis = JSON.parse(jsonStr);
            
            // Validate that all required fields are present
            const requiredFields = ['ats_score', 'skills', 'improvements', 'matched_jobs', 'missing_keywords', 'interview_prep'];
            for (const field of requiredFields) {
                if (!analysis[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            
            // Ensure arrays have content
            if (!Array.isArray(analysis.skills) || analysis.skills.length === 0) analysis.skills = ['N/A'];
            if (!Array.isArray(analysis.improvements) || analysis.improvements.length === 0) analysis.improvements = ['Consider adding more details to your resume'];
            if (!Array.isArray(analysis.matched_jobs) || analysis.matched_jobs.length === 0) analysis.matched_jobs = ['Various Positions'];
            if (!Array.isArray(analysis.missing_keywords) || analysis.missing_keywords.length === 0) analysis.missing_keywords = ['Consider industry keywords'];
            if (!Array.isArray(analysis.interview_prep) || analysis.interview_prep.length === 0) {
                analysis.interview_prep = [
                    { question: 'Tell me about your professional experience', suggested_answer: 'Provide a concise summary highlighting key achievements' },
                    { question: 'What are your strengths?', suggested_answer: 'Mention skills from your resume with specific examples' },
                    { question: 'Where do you see yourself in 5 years?', suggested_answer: 'Align your goals with career development opportunities' },
                    { question: 'Why are you interested in this role?', suggested_answer: 'Connect your skills and experience to the job requirements' }
                ];
            }
            
        } catch (parseErr) {
            console.error('Failed to parse AI response:', response);
            console.error('Parse error:', parseErr.message);
            return res.status(500).json({ error: 'Failed to parse AI response: ' + parseErr.message });
        }

        // Return the analysis
        res.json({
            success: true,
            analysis: analysis,
            file: {
                originalName: req.file.originalname,
                size: req.file.size
            }
        });

    } catch (err) {
        return res.status(400).json({ error: err.message || 'Failed to process resume' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});