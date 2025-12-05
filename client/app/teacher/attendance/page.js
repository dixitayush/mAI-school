"use client";

import { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { Calendar, CheckCircle, Save, Loader2, ArrowLeft, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

const GET_CLASSES_AND_STUDENTS = gql`
  query GetClassesAndStudents {
    allClasses {
      nodes {
        id
        name
      }
    }
    allStudents {
      nodes {
        id
        classId
        userByUserId {
          id
          fullName
          profileByUserId {
            email
          }
        }
      }
    }
  }
`;

function AttendanceContent() {
    const router = useRouter();
    const { loading, error, data } = useQuery(GET_CLASSES_AND_STUDENTS);
    const [activeTab, setActiveTab] = useState('mark'); // 'mark' or 'history'
    const [selectedClass, setSelectedClass] = useState('');
    const [attendanceData, setAttendanceData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [studentStats, setStudentStats] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const classes = data?.allClasses?.nodes || [];
    const students = data?.allStudents?.nodes || [];

    const filteredStudents = selectedClass
        ? students.filter(s => s.classId === selectedClass)
        : [];

    // Fetch Stats when students are loaded or class changes
    useEffect(() => {
        if (filteredStudents.length > 0 && activeTab === 'mark') {
            filteredStudents.forEach(student => {
                fetch(`/api/attendance/stats/${student.id}`)
                    .then(res => res.json())
                    .then(data => {
                        setStudentStats(prev => ({ ...prev, [student.id]: data }));
                    })
                    .catch(err => console.error('Failed to fetch stats', err));
            });
        }
    }, [selectedClass, activeTab]);

    // Fetch History when tab is history and date/class changes
    useEffect(() => {
        if (activeTab === 'history' && selectedClass && date) {
            setLoadingHistory(true);
            fetch(`/api/attendance/history?class_id=${selectedClass}&date=${date}`)
                .then(res => res.json())
                .then(data => {
                    setHistoryData(data);
                })
                .catch(err => console.error('Failed to fetch history', err))
                .finally(() => setLoadingHistory(false));
        }
    }, [activeTab, selectedClass, date]);

    const handleStatusChange = (studentId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], status }
        }));
    };

    const handleRemarksChange = (studentId, remarks) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], remarks }
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        const user = JSON.parse(localStorage.getItem('user'));
        const recordedBy = user?.id;

        try {
            const promises = Object.entries(attendanceData).map(async ([studentId, record]) => {
                if (!record.status) return; // Skip if no status selected

                const res = await fetch('/api/attendance/mark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: studentId,
                        date,
                        status: record.status,
                        remarks: record.remarks,
                        recorded_by: recordedBy
                    })
                });
                return res.json();
            });

            await Promise.all(promises);
            alert('Attendance marked and emails sent successfully!');
            setAttendanceData({});
            // Refresh stats
            if (activeTab === 'mark') {
                // Trigger re-fetch logic if needed, or just let user navigate
            }
        } catch (err) {
            console.error(err);
            alert('Failed to mark attendance');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                                <p className="text-gray-500">Track and manage student attendance</p>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('mark')}
                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mark' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark Attendance
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <History className="w-4 h-4 mr-2" />
                                    View History
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                            >
                                <option value="">Select Class</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-6">
                        {!selectedClass ? (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Calendar className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Select a Class</h3>
                                <p className="text-gray-500 mt-1">Please select a class from the dropdown to proceed.</p>
                            </div>
                        ) : activeTab === 'mark' ? (
                            <>
                                {filteredStudents.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">No students found in this class.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredStudents.map(student => {
                                            const stats = studentStats[student.id] || { percentage: 0, total: 0 };
                                            return (
                                                <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-100 transition-colors">
                                                    <div className="flex items-center space-x-4 w-1/3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                            {student.userByUserId.fullName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{student.userByUserId.fullName}</p>
                                                            <div className="flex items-center text-xs text-gray-500 space-x-2">
                                                                <span>{student.userByUserId.profileByUserId?.email || 'No email'}</span>
                                                                <span className="text-gray-300">|</span>
                                                                <span className={`font-medium ${stats.percentage < 75 ? 'text-red-500' : 'text-green-600'}`}>
                                                                    {stats.percentage}% Attendance
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-6">
                                                        <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                                                            {['present', 'absent', 'late'].map((status) => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleStatusChange(student.id, status)}
                                                                    className={`
                                                                        px-4 py-2 rounded-md text-sm font-medium transition-all
                                                                        ${attendanceData[student.id]?.status === status
                                                                            ? status === 'present' ? 'bg-green-100 text-green-700'
                                                                                : status === 'absent' ? 'bg-red-100 text-red-700'
                                                                                    : 'bg-yellow-100 text-yellow-700'
                                                                            : 'text-gray-500 hover:bg-gray-50'
                                                                        }
                                                                    `}
                                                                >
                                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Remarks (optional)"
                                                            value={attendanceData[student.id]?.remarks || ''}
                                                            onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                                                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 w-48"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {filteredStudents.length > 0 && (
                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting || Object.keys(attendanceData).length === 0}
                                            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                                        >
                                            {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                            Submit Attendance
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            // History Tab
                            <div>
                                {loadingHistory ? (
                                    <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
                                ) : historyData.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">No attendance records found for this date.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {historyData.map(record => {
                                            const student = students.find(s => s.id === record.student_id);
                                            return (
                                                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold">
                                                            {student?.userByUserId?.fullName.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{student?.userByUserId?.fullName || 'Unknown Student'}</p>
                                                            <p className="text-xs text-gray-500">Recorded at: {new Date(record.created_at).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <span className={`px-3 py-1 rounded-full text-sm font-medium
                                                            ${record.status === 'present' ? 'bg-green-100 text-green-700' :
                                                                record.status === 'absent' ? 'bg-red-100 text-red-700' :
                                                                    'bg-yellow-100 text-yellow-700'}`}>
                                                            {record.status.toUpperCase()}
                                                        </span>
                                                        {record.remarks && (
                                                            <span className="text-sm text-gray-500 italic">"{record.remarks}"</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AttendancePage() {
    return (
        <ApolloWrapper>
            <AttendanceContent />
        </ApolloWrapper>
    );
}
