"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import {
    Book, Calendar, Award, TrendingUp, Download,
    GraduationCap, FileText, Clock, CheckCircle2,
    XCircle, Loader2, BarChart3, Target
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateReportCard } from '@/lib/generateReportCard';
import AnnouncementCard from '@/components/AnnouncementCard';
import RecentAttendanceCard from '@/components/RecentAttendanceCard';

const GET_STUDENT_DASHBOARD = gql`
  query GetStudentDashboard($userId: UUID!) {
    allStudents(condition: { userId: $userId }) {
      nodes {
        id
        userByUserId {
          fullName
          username
        }
        classByClassId {
          name
          gradeLevel
        }
        attendancesByStudentId {
          nodes {
            date
            status
            remarks
          }
          totalCount
        }
        resultsByStudentId {
          nodes {
            marksObtained
            grade
            feedback
            examByExamId {
              id
              title
              subject
              totalMarks
              examDate
            }
          }
        }
        feesByStudentId {
          nodes {
            amount
            status
            dueDate
          }
        }
      }
    }
    allExams(orderBy: EXAM_DATE_ASC) {
      nodes {
        id
        title
        subject
        examDate
        totalMarks
      }
    }
  }
`;

export default function StudentDashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || (role !== 'student' && role !== 'admin')) {
            router.push('/login');
        } else {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setUserId(parsedUser.id);
        }
    }, [router]);

    const { loading, data, error } = useQuery(GET_STUDENT_DASHBOARD, {
        variables: { userId },
        skip: !userId,
    });

    const handleDownloadReportCard = () => {
        try {
            if (!studentData) {
                toast.error('No student data available');
                return;
            }

            const reportData = {
                name: studentData.userByUserId?.fullName || 'Student',
                class: studentData.classByClassId?.name || 'N/A',
                rollNumber: studentData.userByUserId?.username || 'N/A',
                results: results.map(r => ({
                    subject: r.examByExamId?.subject || 'N/A',
                    marksObtained: r.marksObtained || 0,
                    totalMarks: r.examByExamId?.totalMarks || 100,
                    grade: r.grade
                })),
                totalDays: totalAttendanceDays,
                presentDays: presentDays,
                absentDays: absentDays,
                attendancePercentage: attendancePercentage,
                overallGrade: calculateOverallGrade(),
                remarks: 'Keep up the good work!'
            };

            generateReportCard(reportData);
            toast.success('Report card downloaded successfully!');
        } catch (error) {
            console.error('Error generating report card:', error);
            toast.error('Failed to generate report card');
        }
    };

    // Prevent hydration mismatch by not rendering until mounted
    if (!mounted || !user) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-zinc-600 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-zinc-600 font-medium">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-zinc-800 font-medium mb-2">Failed to load dashboard</p>
                    <p className="text-zinc-500 text-sm">{error.message}</p>
                </div>
            </div>
        );
    }

    const studentData = data?.allStudents?.nodes?.[0];
    const allExams = data?.allExams?.nodes || [];

    // Calculate attendance statistics
    const attendanceRecords = studentData?.attendancesByStudentId?.nodes || [];
    const totalAttendanceDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
    const lateDays = attendanceRecords.filter(a => a.status === 'late').length;
    const attendancePercentage = totalAttendanceDays > 0
        ? ((presentDays / totalAttendanceDays) * 100).toFixed(1)
        : 0;

    // Calculate fees breakdown
    const feesRecords = studentData?.feesByStudentId?.nodes || [];
    const pendingFees = feesRecords
        .filter(f => f.status === 'pending' || f.status === 'overdue')
        .reduce((sum, f) => sum + parseFloat(f.amount), 0);

    // Get results
    const results = studentData?.resultsByStudentId?.nodes || [];

    // Calculate average marks
    const totalMarksObtained = results.reduce((sum, r) => sum + (r.marksObtained || 0), 0);
    const totalMarks = results.reduce((sum, r) => sum + (r.examByExamId?.totalMarks || 0), 0);
    const averagePercentage = totalMarks > 0
        ? ((totalMarksObtained / totalMarks) * 100).toFixed(1)
        : 0;

    // Get upcoming exams
    const now = new Date();
    const upcomingExams = allExams
        .filter(exam => new Date(exam.examDate) > now)
        .slice(0, 5);

    // Prepare chart data for subject-wise performance
    const performanceData = results.slice(0, 6).map(result => ({
        subject: result.examByExamId?.subject?.substring(0, 10) || 'N/A',
        percentage: result.examByExamId?.totalMarks > 0
            ? ((result.marksObtained / result.examByExamId.totalMarks) * 100).toFixed(1)
            : 0
    }));

    // Recent attendance (last 7 days)
    const recentAttendance = attendanceRecords
        .slice(0, 7)
        .reverse();

    const calculateOverallGrade = () => {
        if (averagePercentage >= 90) return 'A+';
        if (averagePercentage >= 80) return 'A';
        if (averagePercentage >= 70) return 'B+';
        if (averagePercentage >= 60) return 'B';
        if (averagePercentage >= 50) return 'C';
        if (averagePercentage >= 40) return 'D';
        return 'F';
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* Welcome Section with Download */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Welcome Back, {user.full_name}</h1>
                    <p className="text-zinc-500 mt-1">Here&apos;s your academic overview</p>
                </div>
                <button
                    onClick={handleDownloadReportCard}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center space-x-2"
                >
                    <Download className="w-4 h-4" />
                    <span>Download Report Card</span>
                </button>
            </div>

            {/* Welcome Banner */}
            <motion.div
                variants={itemVariants}
                className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">Hello, {user.full_name.split(' ')[0]}! 👋</h2>
                    <p className="text-primary-100 mb-4">
                        Class: {studentData?.classByClassId?.name || 'N/A'} |
                        You have {upcomingExams.length} upcoming exam{upcomingExams.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center space-x-2">
                        <Target className="w-5 h-5" />
                        <span className="font-medium">Keep up the excellent work!</span>
                    </div>
                </div>
            </motion.div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Attendance</p>
                    <p className="text-3xl font-bold text-zinc-900 mt-1">{attendancePercentage}%</p>
                    <p className="text-xs text-zinc-500 mt-2">{presentDays}/{totalAttendanceDays} days present</p>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Award className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Average Marks</p>
                    <p className="text-3xl font-bold text-zinc-900 mt-1">{averagePercentage}%</p>
                    <p className="text-xs text-zinc-500 mt-2">Grade: {calculateOverallGrade()}</p>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-red-100 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Fees Due</p>
                    <p className="text-3xl font-bold text-zinc-900 mt-1">${pendingFees.toLocaleString()}</p>
                    <p className="text-xs text-red-500 mt-2 font-medium">Pending payments</p>
                </motion.div>

                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Upcoming Exams</p>
                    <p className="text-3xl font-bold text-zinc-900 mt-1">{upcomingExams.length}</p>
                    <p className="text-xs text-zinc-500 mt-2">Scheduled assessments</p>
                </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Academic Performance Chart */}
                <motion.div
                    variants={itemVariants}
                    className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-zinc-100"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900">Subject-wise Performance</h2>
                                <p className="text-sm text-zinc-500">Your recent exam results</p>
                            </div>
                        </div>
                    </div>
                    {performanceData.length > 0 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={performanceData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                    <XAxis
                                        dataKey="subject"
                                        stroke="#9CA3AF"
                                        tickLine={false}
                                        axisLine={false}
                                        style={{ fontSize: '12px' }}
                                    />
                                    <YAxis
                                        stroke="#9CA3AF"
                                        tickLine={false}
                                        axisLine={false}
                                        style={{ fontSize: '12px' }}
                                        domain={[0, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: 'none',
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                        }}
                                    />
                                    <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                                        {performanceData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    entry.percentage >= 80 ? '#10B981' :
                                                        entry.percentage >= 60 ? '#3B82F6' :
                                                            entry.percentage >= 40 ? '#F59E0B' : '#EF4444'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-zinc-500">
                            <div className="text-center">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                                <p>No exam results available yet</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Recent Attendance */}
                <motion.div variants={itemVariants}>
                    <RecentAttendanceCard studentId={studentData?.id} />
                </motion.div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Exam Results */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Award className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900">Recent Results</h2>
                                <p className="text-sm text-zinc-500">Your exam performance</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {results.length > 0 ? results.slice(0, 8).map((result, index) => {
                            const percentage = result.examByExamId?.totalMarks > 0
                                ? ((result.marksObtained / result.examByExamId.totalMarks) * 100).toFixed(1)
                                : 0;
                            return (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-zinc-900">{result.examByExamId?.title || 'Exam'}</p>
                                        <p className="text-sm text-zinc-500">{result.examByExamId?.subject || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-zinc-900">
                                            {result.marksObtained}/{result.examByExamId?.totalMarks || 100}
                                        </p>
                                        <p className={`text-sm font-medium ${percentage >= 80 ? 'text-green-600' :
                                            percentage >= 60 ? 'text-blue-600' :
                                                percentage >= 40 ? 'text-orange-600' : 'text-red-600'
                                            }`}>
                                            {percentage}% • {result.grade || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-zinc-500 py-8">No exam results available yet</p>
                        )}
                    </div>
                </motion.div>

                {/* Upcoming Exams */}
                <motion.div variants={itemVariants}>
                    <AnnouncementCard />
                </motion.div>
            </div>
        </motion.div>
    );
}
