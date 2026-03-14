"use client";

import { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import {
    Calendar, CheckCircle, Save, Loader2, History,
    Download, TrendingUp, Users, UserCheck, UserX,
    Clock, BarChart3, Filter, Search, ChevronDown,
    FileText, Printer, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
    const { loading, error, data } = useQuery(GET_CLASSES_AND_STUDENTS);
    const [activeTab, setActiveTab] = useState('mark');
    const [selectedClass, setSelectedClass] = useState('');
    const [attendanceData, setAttendanceData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [studentStats, setStudentStats] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    const classes = data?.allClasses?.nodes || [];
    const students = data?.allStudents?.nodes || [];

    const filteredStudents = selectedClass
        ? students.filter(s => s.classId === selectedClass)
        : [];

    // Calculate statistics for dashboard
    const todayStats = {
        total: filteredStudents.length,
        present: Object.values(attendanceData).filter(a => a?.status === 'present').length,
        absent: Object.values(attendanceData).filter(a => a?.status === 'absent').length,
        late: Object.values(attendanceData).filter(a => a?.status === 'late').length,
    };

    // Pre-populate attendance data from DB when class/date changes (mark tab)
    useEffect(() => {
        if (selectedClass && date && activeTab === 'mark') {
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/attendance/history?class_id=${selectedClass}&date=${date}`)
                .then(res => res.json())
                .then(records => {
                    if (Array.isArray(records) && records.length > 0) {
                        const existing = {};
                        records.forEach(r => {
                            existing[r.student_id] = { status: r.status, remarks: r.remarks || '' };
                        });
                        setAttendanceData(existing);
                    } else {
                        setAttendanceData({});
                    }
                })
                .catch(err => {
                    console.error('Failed to load existing attendance', err);
                    setAttendanceData({});
                });
        }
    }, [selectedClass, date, activeTab]);

    // Fetch Stats when students are loaded or class changes
    useEffect(() => {
        if (filteredStudents.length > 0 && activeTab === 'mark') {
            filteredStudents.forEach(student => {
                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/attendance/stats/${student.id}`)
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
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/attendance/history?class_id=${selectedClass}&date=${date}`)
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

    const handleBulkMark = (status) => {
        const bulkData = {};
        filteredStudents.forEach(student => {
            bulkData[student.id] = { status, remarks: '' };
        });
        setAttendanceData(bulkData);
        toast.success(`All students marked as ${status}!`);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        const user = JSON.parse(localStorage.getItem('user'));
        const recordedBy = user?.id;

        try {
            const promises = Object.entries(attendanceData).map(async ([studentId, record]) => {
                if (!record.status) return;

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/attendance/mark`, {
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
            toast.success('Attendance marked and emails sent successfully!');
            setAttendanceData({});
        } catch (err) {
            console.error(err);
            toast.error('Failed to mark attendance');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExportCSV = () => {
        if (!selectedClass || filteredStudents.length === 0) {
            toast.error('Please select a class first');
            return;
        }

        const headers = ['Student Name', 'Email', 'Status', 'Remarks', 'Attendance %'];
        const rows = filteredStudents.map(student => {
            const stats = studentStats[student.id] || { percentage: 0 };
            const attendance = attendanceData[student.id];
            return [
                student.userByUserId.fullName,
                student.userByUserId.profileByUserId?.email || 'N/A',
                attendance?.status || 'Not Marked',
                attendance?.remarks || '',
                `${stats.percentage}%`
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${date}-${selectedClass}.csv`;
        a.click();
        toast.success('Exported to CSV!');
    };

    const handlePrint = () => {
        window.print();
        toast.success('Print dialog opened!');
    };

    // Filter students based on search and status filter
    const displayedStudents = filteredStudents.filter(student => {
        const matchesSearch = student.userByUserId.fullName.toLowerCase().includes(searchQuery.toLowerCase());
        const attendance = attendanceData[student.id];
        const matchesFilter = filterStatus === 'all' || attendance?.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-gray-500">Loading attendance system...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
                        <p className="text-gray-500 mt-1">Track, manage, and analyze student attendance</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Dashboard - Only show when class is selected */}
            <AnimatePresence>
                {selectedClass && activeTab === 'mark' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
                    >
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-600 text-sm font-medium mb-1">Total Students</p>
                                    <p className="text-3xl font-bold text-blue-900">{todayStats.total}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-blue-700" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-600 text-sm font-medium mb-1">Present</p>
                                    <p className="text-3xl font-bold text-green-900">{todayStats.present}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                                    <UserCheck className="w-6 h-6 text-green-700" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-600 text-sm font-medium mb-1">Absent</p>
                                    <p className="text-3xl font-bold text-red-900">{todayStats.absent}</p>
                                </div>
                                <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
                                    <UserX className="w-6 h-6 text-red-700" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-yellow-600 text-sm font-medium mb-1">Late</p>
                                    <p className="text-3xl font-bold text-yellow-900">{todayStats.late}</p>
                                </div>
                                <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-yellow-700" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        {/* Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('mark')}
                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mark' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Mark Attendance
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <History className="w-4 h-4 mr-2" />
                                View History
                            </button>
                            <button
                                onClick={() => setActiveTab('analytics')}
                                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Analytics
                            </button>
                        </div>

                        {/* Bulk Actions (only in mark tab) */}
                        {activeTab === 'mark' && selectedClass && (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => handleBulkMark('present')}
                                    className="flex items-center px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                >
                                    <UserCheck className="w-4 h-4 mr-1" />
                                    All Present
                                </button>
                                <button
                                    onClick={() => handleBulkMark('absent')}
                                    className="flex items-center px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                >
                                    <UserX className="w-4 h-4 mr-1" />
                                    All Absent
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Filters and Date Selection */}
                    <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            />
                        </div>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white min-w-[200px]"
                        >
                            <option value="">Select Class</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>

                        {activeTab === 'mark' && selectedClass && (
                            <>
                                <div className="flex items-center bg-gray-100 rounded-lg px-4 py-2 flex-1 min-w-[250px]">
                                    <Search className="w-5 h-5 text-gray-400 mr-2" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
                                    />
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <Filter className="w-4 h-4 mr-2 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-700">Filter</span>
                                        <ChevronDown className={`w-4 h-4 ml-2 text-gray-600 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showFilters && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                            <div className="p-2">
                                                {['all', 'present', 'absent', 'late'].map(status => (
                                                    <button
                                                        key={status}
                                                        onClick={() => {
                                                            setFilterStatus(status);
                                                            setShowFilters(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${filterStatus === status ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                                    >
                                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    {!selectedClass ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-primary-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Select a Class</h3>
                            <p className="text-gray-500 mt-1">Please select a class from the dropdown to proceed.</p>
                        </div>
                    ) : activeTab === 'mark' ? (
                        <>
                            {displayedStudents.length === 0 ? (
                                <div className="text-center py-12">
                                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500">
                                        {searchQuery || filterStatus !== 'all'
                                            ? 'No students match your filters'
                                            : 'No students found in this class'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayedStudents.map(student => {
                                        const stats = studentStats[student.id] || { percentage: 0, total: 0 };
                                        const isLowAttendance = stats.percentage < 75;
                                        return (
                                            <motion.div
                                                key={student.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary-100 hover:shadow-sm transition-all"
                                            >
                                                <div className="flex items-center space-x-4 flex-1">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                                                        {student.userByUserId.fullName.charAt(0)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2">
                                                            <p className="font-medium text-gray-900">{student.userByUserId.fullName}</p>
                                                            {isLowAttendance && (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium flex items-center">
                                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                                    Low
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center text-xs text-gray-500 space-x-2 mt-1">
                                                            <span>{student.userByUserId.profileByUserId?.email || 'No email'}</span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className={`font-medium ${isLowAttendance ? 'text-red-500' : 'text-green-600'}`}>
                                                                {stats.percentage}% Overall Attendance
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-4">
                                                    <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                                                        {['present', 'absent', 'late'].map((status) => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleStatusChange(student.id, status)}
                                                                className={`
                                                                    px-4 py-2 rounded-md text-sm font-medium transition-all
                                                                    ${attendanceData[student.id]?.status === status
                                                                        ? status === 'present' ? 'bg-green-100 text-green-700 shadow-sm'
                                                                            : status === 'absent' ? 'bg-red-100 text-red-700 shadow-sm'
                                                                                : 'bg-yellow-100 text-yellow-700 shadow-sm'
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
                                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 w-48"
                                                    />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}

                            {filteredStudents.length > 0 && (
                                <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-100">
                                    <div className="text-sm text-gray-500">
                                        {Object.keys(attendanceData).length} of {filteredStudents.length} students marked
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || Object.keys(attendanceData).length === 0}
                                        className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                        {submitting ? 'Submitting...' : 'Submit Attendance'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : activeTab === 'history' ? (
                        <div>
                            {loadingHistory ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
                                    <p className="text-gray-500 mt-3">Loading history...</p>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500">No attendance records found for this date.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
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
                    ) : (
                        // Analytics Tab
                        <div className="text-center py-20">
                            <BarChart3 className="w-16 h-16 text-primary-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
                            <p className="text-gray-500 mt-1">Advanced analytics and trends coming soon!</p>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-gray-700">Attendance Trends</p>
                                    <p className="text-xs text-gray-500 mt-1">Weekly and monthly patterns</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <BarChart3 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-gray-700">Class Comparison</p>
                                    <p className="text-xs text-gray-500 mt-1">Compare across classes</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <Calendar className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-gray-700">Calendar View</p>
                                    <p className="text-xs text-gray-500 mt-1">Visual attendance calendar</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { AttendanceContent };
