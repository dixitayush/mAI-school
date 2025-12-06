const { Pool } = require('pg');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mai_school';
const pool = new Pool({ connectionString: DATABASE_URL });

const API_PORT = 5000;

function makeRequest(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: API_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function verify() {
    try {
        console.log('Starting verification...');

        // 1. Register a student with parent details via GraphQL
        const username = `teststudent_${Date.now()}`;
        const mutation = `
            mutation {
                registerStudent(input: {
                    username: "${username}",
                    password: "password123",
                    fullName: "Test Student",
                    email: "${username}@example.com",
                    parentName: "Test Parent",
                    parentEmail: "parent_${username}@example.com",
                    parentPhone: "+1234567890",
                    parentAddress: "123 Test St"
                }) {
                    student {
                        id
                        userByUserId {
                            username
                        }
                        parentByParentId {
                            fullName
                            phone
                        }
                    }
                }
            }
        `;

        console.log('1. Registering student...');
        const graphqlData = await makeRequest('/graphql', 'POST', { query: mutation });

        if (graphqlData.errors) {
            throw new Error('GraphQL Error: ' + JSON.stringify(graphqlData.errors));
        }

        const student = graphqlData.data.registerStudent.student;
        console.log('Student registered:', student.id);
        console.log('Parent linked:', student.parentByParentId.fullName);

        if (student.parentByParentId.fullName !== 'Test Parent') {
            throw new Error('Parent name mismatch');
        }

        // 2. Mark Attendance
        console.log('2. Marking attendance...');
        const attendanceData = await makeRequest('/api/attendance/mark', 'POST', {
            student_id: student.id,
            date: new Date().toISOString(),
            status: 'absent',
            remarks: 'Test verification',
            recorded_by: null // Optional or mock ID
        });

        if (attendanceData.error) {
            throw new Error('Attendance API Error: ' + attendanceData.error);
        }

        console.log('Attendance marked:', attendanceData.data.id);
        console.log('Check server logs for "Sending SMS" message.');

        console.log('Verification passed!');

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await pool.end();
    }
}

verify();
