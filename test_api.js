const http = require('http');
const path = require('path');
const fs = require('fs');

// Import Express app
const app = require('./server.js');

let server;
const PORT = 5055; // Use dedicated test port

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      ...options,
      hostname: '127.0.0.1'
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', err => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING INTERNCONNECT FULL TEST SUITE ---');
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

  // 1. Health check test
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/health returns 200 OK');
    assert(res.body.success === true && res.body.status === 'UP', 'Health reports status UP');
    assert(res.body.totalRecords >= 12, `Total records in DB >= 12 (found: ${res.body.totalRecords})`);
  } catch (e) {
    assert(false, `Health check failed: ${e.message}`);
  }

  // 2. GET /api/internships (all)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships returns 200 OK');
    assert(res.body.success === true, 'Response has success: true');
    assert(Array.isArray(res.body.data) && res.body.data.length >= 12, `Returns list with >= 12 items (count: ${res.body.count})`);
  } catch (e) {
    assert(false, `GET /api/internships failed: ${e.message}`);
  }

  // 3. Search query test (e.g. search=Python)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships?search=Python',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships?search=Python returns 200');
    assert(res.body.data.length > 0, `Search finds Python internships (count: ${res.body.data.length})`);
    const allMatch = res.body.data.every(item => 
      item.title.toLowerCase().includes('python') ||
      item.domain.toLowerCase().includes('python') ||
      item.description.toLowerCase().includes('python') ||
      item.skills.some(s => s.toLowerCase().includes('python'))
    );
    assert(allMatch, 'Every returned search item matches keyword "Python"');
  } catch (e) {
    assert(false, `Search test failed: ${e.message}`);
  }

  // 4. Domain filter test (e.g. domain=UI/UX Design)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships?domain=UI%2FUX%20Design',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships?domain=UI/UX Design returns 200');
    assert(res.body.data.length > 0, `Finds UI/UX records (count: ${res.body.data.length})`);
    assert(res.body.data.every(i => i.domain === 'UI/UX Design'), 'All returned records are in "UI/UX Design"');
  } catch (e) {
    assert(false, `Domain filter test failed: ${e.message}`);
  }

  // 5. WorkMode filter test (e.g. workMode=Remote)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships?workMode=Remote',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships?workMode=Remote returns 200');
    assert(res.body.data.length > 0, `Finds Remote records (count: ${res.body.data.length})`);
    assert(res.body.data.every(i => i.workMode === 'Remote'), 'All returned records are Remote');
  } catch (e) {
    assert(false, `WorkMode filter test failed: ${e.message}`);
  }

  // 6. MinStipend filter test (e.g. minStipend=40000)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships?minStipend=40000',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships?minStipend=40000 returns 200');
    assert(res.body.data.length > 0, `Finds high stipend records (count: ${res.body.data.length})`);
    assert(res.body.data.every(i => i.stipendAmount >= 40000), 'All returned stipends >= ₹40,000');
  } catch (e) {
    assert(false, `MinStipend filter test failed: ${e.message}`);
  }

  // 7. Sort test (sortBy=stipend_desc)
  try {
    const res = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships?sortBy=stipend_desc',
      method: 'GET'
    });
    assert(res.statusCode === 200, 'GET /api/internships?sortBy=stipend_desc returns 200');
    let isSorted = true;
    for (let i = 0; i < res.body.data.length - 1; i++) {
      if (res.body.data[i].stipendAmount < res.body.data[i + 1].stipendAmount) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted, 'Results are sorted in descending order of stipend');
  } catch (e) {
    assert(false, `Sort test failed: ${e.message}`);
  }

  // 8. GET /api/internships/:id (valid ID and invalid ID)
  try {
    const validRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships/int-001',
      method: 'GET'
    });
    assert(validRes.statusCode === 200, 'GET /api/internships/int-001 returns 200');
    assert(validRes.body.data && validRes.body.data.id === 'int-001', 'Returns matching record for int-001');

    const invalidRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships/non-existent-id-999',
      method: 'GET'
    });
    assert(invalidRes.statusCode === 404, 'GET invalid ID returns 404 Not Found');
    assert(invalidRes.body.success === false, 'Error body has success: false');
  } catch (e) {
    assert(false, `Get by ID test failed: ${e.message}`);
  }

  // 9. POST /api/internships - Validation error test
  try {
    const invalidPost = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      company: '', // Missing title, domain, etc.
      stipend: '₹20,000'
    });
    assert(invalidPost.statusCode === 400, 'POST with missing required fields returns 400 Bad Request');
    assert(invalidPost.body.details && invalidPost.body.details.length > 0, 'Returns specific validation error details');
  } catch (e) {
    assert(false, `Validation error test failed: ${e.message}`);
  }

  // 10. POST /api/internships - Success test & DELETE test
  let createdId = null;
  try {
    const newRecord = {
      company: 'Quantum Dynamics Test Lab',
      title: 'Quantum Software Developer Intern',
      domain: 'Cloud Computing',
      location: 'Hyderabad, Telangana',
      workMode: 'Hybrid',
      duration: '6 Months',
      stipend: '₹48,000 / month',
      stipendAmount: 48000,
      skills: ['Qiskit', 'Python', 'Docker'],
      description: 'Test internship for quantum algorithm design'
    };

    const postRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/internships',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newRecord);

    assert(postRes.statusCode === 201, 'POST /api/internships creates record with 201 Created');
    assert(postRes.body.success === true, 'Response success is true');
    assert(postRes.body.data && postRes.body.data.id, 'New record assigned unique ID');
    createdId = postRes.body.data ? postRes.body.data.id : null;

    // Verify it exists in GET by ID
    if (createdId) {
      const getNew = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/internships/${createdId}`,
        method: 'GET'
      });
      assert(getNew.statusCode === 200, `GET newly created record by ID ${createdId} returns 200`);

      // 11. DELETE /api/internships/:id
      const delRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/internships/${createdId}`,
        method: 'DELETE'
      });
      assert(delRes.statusCode === 200, 'DELETE /api/internships/:id returns 200 OK');

      // Verify it is gone
      const checkDeleted = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/internships/${createdId}`,
        method: 'GET'
      });
      assert(checkDeleted.statusCode === 404, 'GET deleted record returns 404 Not Found');
    }
  } catch (e) {
    assert(false, `Create & Delete test failed: ${e.message}`);
  }

  // 12. Frontend Static File Serving test
  try {
    const feRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET'
    });
    assert(feRes.statusCode === 200, 'GET / serves frontend index.html with 200 OK');
    const html = typeof feRes.body === 'string' ? feRes.body : JSON.stringify(feRes.body);
    assert(html.includes('InternConnect') && html.includes('Find Your Dream Internship'), 'HTML contains correct branding and title');
  } catch (e) {
    assert(false, `Frontend serving test failed: ${e.message}`);
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed === 0) {
    console.log('🎉 ALL BACKEND AND REST API TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`⚠️ ${failed} test(s) failed.`);
    process.exitCode = 1;
  }
}

// Start temporary server on PORT 5055 to test
server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}...`);
  try {
    await runTests();
  } finally {
    server.close(() => {
      console.log('Test server closed cleanly.');
      process.exit(process.exitCode || 0);
    });
  }
});
