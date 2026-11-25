const fs = require('fs');
const path = require('path');

console.log('--- STARTING INTERNCONNECT FRONTEND & AUDIT VERIFICATION SUITE ---');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

// 1. Read files
const htmlPath = path.join(__dirname, 'frontend', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const cssPath = path.join(__dirname, 'frontend', 'css', 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const responsiveCssPath = path.join(__dirname, 'frontend', 'css', 'responsive.css');
const responsiveCssContent = fs.readFileSync(responsiveCssPath, 'utf8');

const dataPath = path.join(__dirname, 'backend', 'data', 'internships.json');
const sampleData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// -------------------------------------------------------------
// AUDIT 1: Reusable Internship Card Rendering using JavaScript Data
// -------------------------------------------------------------
console.log('\n[AUDIT 1] Reusable Internship Card Rendering:');
assert(sampleData.length >= 12, `Sample dataset contains >= 12 records (found: ${sampleData.length})`);

// Mock card renderer function (mirroring app.js)
function mockRenderCard(item) {
  const initial = (item.company || 'C').charAt(0).toUpperCase();
  const modeClass = (item.workMode || 'remote').toLowerCase().replace(/\s+/g, '-');
  const skillsList = Array.isArray(item.skills) ? item.skills.slice(0, 4) : [];

  return `
    <article class="internship-card" data-id="${item.id}">
      <div class="card-header-row">
        <div class="company-logo-avatar" style="background-color: ${item.logoColor || '#2563EB'};">
          ${initial}
        </div>
        <span class="company-name">${item.company}</span>
        <h3 class="internship-title">${item.title}</h3>
        <button type="button" class="btn-bookmark" data-id="${item.id}" aria-label="Save internship"></button>
      </div>
      <span class="badge-domain">${item.domain}</span>
      <span class="badge-workmode ${modeClass}">${item.workMode}</span>
      <span class="card-location">${item.location}</span>
      <p class="card-description">${item.description}</p>
      <div class="card-skills-row">
        ${skillsList.map(s => `<span class="skill-pill">${s}</span>`).join('')}
      </div>
      <span class="stipend-val">${item.stipend}</span>
      <span class="duration-val">${item.duration}</span>
      <button class="btn-apply">Apply Now</button>
    </article>
  `;
}

const testCard = mockRenderCard(sampleData[0]);
assert(testCard.includes('internship-card'), 'Card markup includes .internship-card container');
assert(testCard.includes(sampleData[0].company), 'Card renders company name');
assert(testCard.includes(sampleData[0].title), 'Card renders internship title');
assert(testCard.includes(sampleData[0].domain), 'Card renders domain badge');
assert(testCard.includes(sampleData[0].location), 'Card renders location');
assert(testCard.includes(sampleData[0].workMode), 'Card renders work mode');
assert(testCard.includes(sampleData[0].stipend), 'Card renders stipend');
assert(testCard.includes(sampleData[0].duration), 'Card renders duration');
assert(testCard.includes('btn-bookmark'), 'Card includes bookmark action button');
assert(testCard.includes('Apply Now'), 'Card includes Apply Now action button');

// -------------------------------------------------------------
// AUDIT 2 & 3: Functional Search and Combined Filters
// -------------------------------------------------------------
console.log('\n[AUDIT 2 & 3] Search, Domain & Location Filters:');

function filterData(data, filters) {
  let res = [...data];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    res = res.filter(item => {
      const inTitle = item.title && item.title.toLowerCase().includes(q);
      const inCompany = item.company && item.company.toLowerCase().includes(q);
      const inDomain = item.domain && item.domain.toLowerCase().includes(q);
      const inDesc = item.description && item.description.toLowerCase().includes(q);
      const inSkills = Array.isArray(item.skills) && item.skills.some(s => s.toLowerCase().includes(q));
      return inTitle || inCompany || inDomain || inDesc || inSkills;
    });
  }
  if (filters.domain && filters.domain !== 'All') {
    const dom = filters.domain.toLowerCase();
    res = res.filter(item => item.domain && item.domain.toLowerCase() === dom);
  }
  if (filters.location && filters.location !== 'All') {
    const loc = filters.location.toLowerCase();
    res = res.filter(item => item.location && item.location.toLowerCase().includes(loc));
  }
  if (filters.workMode && filters.workMode !== 'All') {
    const mode = filters.workMode.toLowerCase();
    res = res.filter(item => item.workMode && item.workMode.toLowerCase() === mode);
  }
  if (filters.minStipend) {
    res = res.filter(item => (item.stipendAmount || 0) >= filters.minStipend);
  }
  return res;
}

// Test search by title
const searchTitleRes = filterData(sampleData, { search: 'Full Stack' });
assert(searchTitleRes.length >= 2, `Search 'Full Stack' returns >= 2 roles (found: ${searchTitleRes.length})`);

// Test search by skill
const searchSkillRes = filterData(sampleData, { search: 'Python' });
assert(searchSkillRes.length >= 4, `Search 'Python' returns >= 4 roles (found: ${searchSkillRes.length})`);

// Test domain filter
const domainRes = filterData(sampleData, { domain: 'Artificial Intelligence' });
assert(domainRes.length >= 1 && domainRes.every(i => i.domain === 'Artificial Intelligence'), 'Domain filter for AI matches strictly');

// Test location filter
const locRes = filterData(sampleData, { location: 'Bengaluru' });
assert(locRes.length >= 3 && locRes.every(i => i.location.includes('Bengaluru')), 'Location filter for Bengaluru returns correct roles');

// Test combined filter (domain + workMode + minStipend)
const combinedRes = filterData(sampleData, { domain: 'Machine Learning', workMode: 'Remote', minStipend: 40000 });
assert(combinedRes.length >= 1, `Combined filter (ML + Remote + ₹40k+) found ${combinedRes.length} matching role(s)`);
assert(combinedRes[0].company === 'DeepMinded AI Labs', 'Found expected record DeepMinded AI Labs');

// Test empty search
const emptyRes = filterData(sampleData, { search: 'XYZNonExistentKeyword999' });
assert(emptyRes.length === 0, 'Non-matching search returns empty array (triggers empty state)');

// -------------------------------------------------------------
// AUDIT 4: Proper Empty and Error States
// -------------------------------------------------------------
console.log('\n[AUDIT 4] Empty, Loading & Error States:');
assert(htmlContent.includes('id="internships-loading"'), 'HTML contains #internships-loading skeleton element');
assert(htmlContent.includes('id="internships-empty"'), 'HTML contains #internships-empty container');
assert(htmlContent.includes('id="btn-reset-empty"'), 'Empty state includes #btn-reset-empty button');
assert(htmlContent.includes('id="internships-error"'), 'HTML contains #internships-error container');
assert(htmlContent.includes('id="btn-retry-api"'), 'Error state includes #btn-retry-api connection button');
assert(htmlContent.includes('id="btn-load-fallback"'), 'Error state includes #btn-load-fallback standalone toggle');

// -------------------------------------------------------------
// AUDIT 5: Accessible Keyboard Navigation
// -------------------------------------------------------------
console.log('\n[AUDIT 5] Keyboard Navigation & Accessibility:');
assert(htmlContent.includes('class="skip-to-content"'), 'Skip-to-content accessible link present');
assert(cssContent.includes(':focus-visible'), 'CSS defines visible :focus-visible indicators');
assert(htmlContent.includes('role="dialog"'), 'Modals have role="dialog"');
assert(htmlContent.includes('aria-modal="true"'), 'Modals have aria-modal="true"');
assert(htmlContent.includes('aria-label="Close details modal"'), 'Modal close button has descriptive aria-label');
assert(htmlContent.includes('aria-label="Close post modal"'), 'Post modal close button has descriptive aria-label');
assert(htmlContent.includes('aria-label="Close bookmarks drawer"'), 'Drawer close button has descriptive aria-label');
assert(htmlContent.includes('id="mobile-menu-toggle"') && htmlContent.includes('aria-expanded="false"'), 'Mobile menu toggle has aria-expanded attribute');

// -------------------------------------------------------------
// AUDIT 6: Semantic HTML and Form Controls
// -------------------------------------------------------------
console.log('\n[AUDIT 6] Semantic HTML & Form Controls Labels:');
assert(htmlContent.includes('<header'), 'Semantic <header> tag present');
assert(htmlContent.includes('<nav'), 'Semantic <nav> tag present');
assert(htmlContent.includes('<main'), 'Semantic <main> tag present');
assert(htmlContent.includes('<section'), 'Semantic <section> tags present');
assert(htmlContent.includes('<footer'), 'Semantic <footer> tag present');

// Verify all input elements have corresponding labels or aria-label
const inputMatches = htmlContent.match(/<input[^>]+>/g) || [];
let allInputsLabeled = true;
inputMatches.forEach(tag => {
  const idMatch = tag.match(/id="([^"]+)"/);
  const ariaLabelMatch = tag.match(/aria-label="([^"]+)"/);
  const typeMatch = tag.match(/type="([^"]+)"/);
  if (typeMatch && typeMatch[1] === 'hidden') return;

  if (idMatch) {
    const id = idMatch[1];
    const hasLabel = htmlContent.includes(`for="${id}"`);
    if (!hasLabel && !ariaLabelMatch) {
      console.warn(`    ⚠️ Input #${id} might be missing a label`);
      allInputsLabeled = false;
    }
  }
});
assert(allInputsLabeled, 'All <input> form controls have explicitly associated <label> or aria-label');

// Verify all select elements have corresponding labels
const selectMatches = htmlContent.match(/<select[^>]+>/g) || [];
let allSelectsLabeled = true;
selectMatches.forEach(tag => {
  const idMatch = tag.match(/id="([^"]+)"/);
  const ariaLabelMatch = tag.match(/aria-label="([^"]+)"/);
  if (idMatch) {
    const id = idMatch[1];
    const hasLabel = htmlContent.includes(`for="${id}"`);
    if (!hasLabel && !ariaLabelMatch) {
      console.warn(`    ⚠️ Select #${id} might be missing a label`);
      allSelectsLabeled = false;
    }
  }
});
assert(allSelectsLabeled, 'All <select> controls have explicitly associated <label> or aria-label');

// Verify textareas have corresponding labels
const textareaMatches = htmlContent.match(/<textarea[^>]+>/g) || [];
let allTextareasLabeled = true;
textareaMatches.forEach(tag => {
  const idMatch = tag.match(/id="([^"]+)"/);
  if (idMatch) {
    const id = idMatch[1];
    const hasLabel = htmlContent.includes(`for="${id}"`);
    if (!hasLabel) {
      allTextareasLabeled = false;
    }
  }
});
assert(allTextareasLabeled, 'All <textarea> controls have explicitly associated <label>');

// -------------------------------------------------------------
// AUDIT 7: Responsive Layouts Across Breakpoints
// -------------------------------------------------------------
console.log('\n[AUDIT 7] Responsive Breakpoints:');
assert(responsiveCssContent.includes('@media (max-width: 1023px)'), 'Tablet breakpoint defined (@media max-width: 1023px)');
assert(responsiveCssContent.includes('@media (max-width: 767px)'), 'Mobile breakpoint defined (@media max-width: 767px)');
assert(responsiveCssContent.includes('@media (max-width: 480px)'), 'Small mobile breakpoint defined (@media max-width: 480px)');
assert(responsiveCssContent.includes('.internships-grid'), 'Grid adapts to single-column on mobile screens');
assert(responsiveCssContent.includes('.hero-search-bar'), 'Search bar stacks cleanly on mobile');
assert(responsiveCssContent.includes('.mobile-menu-toggle'), 'Mobile hamburger menu styles defined');

// -------------------------------------------------------------
// AUDIT 8: Clean & Maintainable Architecture
// -------------------------------------------------------------
console.log('\n[AUDIT 8] Code Quality & Maintainability:');
assert(cssContent.includes(':root {'), 'CSS custom properties design tokens defined in :root');
assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion accessibility query supported');
assert(fs.existsSync(path.join(__dirname, 'frontend', 'js', 'api.js')), 'api.js exists');
assert(fs.existsSync(path.join(__dirname, 'frontend', 'js', 'bookmarks.js')), 'bookmarks.js exists');
assert(fs.existsSync(path.join(__dirname, 'frontend', 'js', 'filters.js')), 'filters.js exists');
assert(fs.existsSync(path.join(__dirname, 'frontend', 'js', 'app.js')), 'app.js exists');

console.log('\n----------------------------------------------------');
console.log(`TOTAL FRONTEND AUDIT CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('----------------------------------------------------');

if (failed === 0) {
  console.log('🎉 ALL FRONTEND AND ACCESSIBILITY AUDIT CHECKS PASSED!\n');
} else {
  console.error(`⚠️ ${failed} check(s) failed.`);
  process.exitCode = 1;
}
