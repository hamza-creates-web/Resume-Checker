// ========================================
// DOM Elements
// ========================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFile');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const uploadSection = document.getElementById('uploadSection');
const resultsDashboard = document.getElementById('resultsDashboard');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const atsScoreEl = document.getElementById('atsScore');
const scoreProgress = document.getElementById('scoreProgress');
const scoreLabel = document.getElementById('scoreLabel');
const skillsGrid = document.getElementById('skillsGrid');
const improvementsList = document.getElementById('improvementsList');
const downloadBtn = document.getElementById('downloadBtn');

let selectedFile = null;

// ========================================
// Event Listeners
// ========================================

// Click on drop zone to trigger file input
dropZone.addEventListener('click', () => {
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Drag and drop events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Remove file button
removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileSelection();
});

// Upload button
uploadBtn.addEventListener('click', uploadFile);

// New analysis button
newAnalysisBtn.addEventListener('click', () => {
    resultsDashboard.hidden = true;
    uploadSection.hidden = false;
    resetFileSelection();
});

// Download report button
downloadBtn.addEventListener('click', () => {
    // Scroll to top before generating PDF to prevent blank pages
    window.scrollTo(0, 0);
    
    // Clone the results dashboard to modify for PDF
    const element = resultsDashboard.cloneNode(true);
    
    // Remove the download button from the clone
    const downloadSection = element.querySelector('.download-section');
    if (downloadSection) {
        downloadSection.remove();
    }
    
    // Expand all accordion items for PDF
    const accordionItems = element.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        item.classList.add('active');
        item.querySelector('.accordion-content').style.maxHeight = 'none';
    });
    
    // Add print-mode class for PDF styling
    resultsDashboard.classList.add('print-mode');
    
    // Update the html2pdf configuration to improve resolution and ensure proper rendering
    const opt = {
        margin: [15, 15, 15, 15],
        filename: 'Resume-Analysis-Report.pdf',
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 3, scrollY: 0, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    // Generate and download PDF
    html2pdf().set(opt).from(element).save().then(() => {
        // Remove print-mode class after PDF is generated
        resultsDashboard.classList.remove('print-mode');
    });
});

// ========================================
// Functions
// ========================================

/**
 * Handle file selection
 * @param {File} file - The selected file
 */
function handleFileSelect(file) {
    // Validate file type
    if (file.type !== 'application/pdf') {
        showError('Please upload a PDF file only.');
        return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('File size must be less than 10MB.');
        return;
    }

    // Clear any previous errors
    hideError();

    // Store the file
    selectedFile = file;

    // Update UI
    fileName.textContent = file.name;
    dropZone.hidden = true;
    fileInfo.hidden = false;
    loading.hidden = true;
}

/**
 * Reset file selection
 */
function resetFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    fileName.textContent = '';
    dropZone.hidden = false;
    fileInfo.hidden = true;
    loading.hidden = true;
    hideError();
}

/**
 * Upload file to server
 */
async function uploadFile() {
    if (!selectedFile) {
        showError('Please select a file first.');
        return;
    }

    // Show loading state
    fileInfo.hidden = true;
    loading.hidden = false;
    hideError();

    // Create FormData
    const formData = new FormData();
    formData.append('resume', selectedFile);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }

        // Handle successful upload with AI analysis
        console.log('Analysis complete:', data);
        
        // Display the results dashboard
        displayResults(data.analysis);

    } catch (error) {
        console.error('Upload error:', error);
        showError(error.message);
        loading.hidden = true;
        fileInfo.hidden = false;
    }
}

/**
 * Display the analysis results in the dashboard
 * @param {Object} analysis - The AI analysis result
 */
function displayResults(analysis) {
    // Hide loading, show dashboard
    loading.hidden = true;
    uploadSection.hidden = true;
    resultsDashboard.hidden = false;

    // Set ATS Score with animation
    const score = analysis.ats_score || 0;
    atsScoreEl.textContent = score;
    
    // Animate the score circle
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (score / 100) * circumference;
    scoreProgress.style.strokeDashoffset = offset;
    
    // Set score label based on value
    let label = 'Needs Improvement';
    if (score >= 80) label = 'Excellent';
    else if (score >= 60) label = 'Good';
    else if (score >= 40) label = 'Fair';
    scoreLabel.textContent = label;
    
    // Set score color based on value
    if (score >= 80) {
        scoreProgress.style.stroke = '#10b981';
    } else if (score >= 60) {
        scoreProgress.style.stroke = '#4f46e5';
    } else if (score >= 40) {
        scoreProgress.style.stroke = '#f59e0b';
    } else {
        scoreProgress.style.stroke = '#ef4444';
    }

    // Display skills
    skillsGrid.innerHTML = '';
    const skills = analysis.skills || [];
    skills.forEach(skill => {
        const skillTag = document.createElement('span');
        skillTag.className = 'skill-tag';
        skillTag.textContent = skill;
        skillsGrid.appendChild(skillTag);
    });

    // Display matched jobs
    const matchedJobsGrid = document.getElementById('matchedJobsGrid');
    matchedJobsGrid.innerHTML = '';
    const matchedJobs = analysis.matched_jobs || [];
    matchedJobs.forEach(job => {
        const jobTag = document.createElement('span');
        jobTag.className = 'skill-tag job-tag';
        jobTag.textContent = job;
        matchedJobsGrid.appendChild(jobTag);
    });

    // Display missing keywords
    const missingKeywordsGrid = document.getElementById('missingKeywordsGrid');
    missingKeywordsGrid.innerHTML = '';
    const missingKeywords = analysis.missing_keywords || [];
    missingKeywords.forEach(keyword => {
        const keywordTag = document.createElement('span');
        keywordTag.className = 'skill-tag warning-tag';
        keywordTag.textContent = keyword;
        missingKeywordsGrid.appendChild(keywordTag);
    });

    // Display improvements
    improvementsList.innerHTML = '';
    const improvements = analysis.improvements || [];
    improvements.forEach(improvement => {
        const li = document.createElement('li');
        li.className = 'improvement-item';
        li.innerHTML = `
            <svg class="improvement-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span class="improvement-text">${improvement}</span>
        `;
        improvementsList.appendChild(li);
    });

    // Display interview prep accordion
    const interviewPrepList = document.getElementById('interviewPrepList');
    interviewPrepList.innerHTML = '';
    const interviewPrep = analysis.interview_prep || [];
    interviewPrep.forEach((item, index) => {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        accordionItem.innerHTML = `
            <button class="accordion-header">
                <span class="accordion-question">${item.question}</span>
                <svg class="accordion-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="accordion-content">
                <p>${item.suggested_answer}</p>
            </div>
        `;
        interviewPrepList.appendChild(accordionItem);
    });

    // Add accordion click handlers
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

/**
 * Hide error message
 */
function hideError() {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
}

// ========================================
// Prevent default drag behavior on window
// ========================================
window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
});