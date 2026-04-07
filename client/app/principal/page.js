"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import {
    BarChart3, FileText, TrendingUp, AlertTriangle, Loader2,
    Download, DollarSign, User, Users, GraduationCap, Calendar,
    CheckCircle, XCircle, Clock, Award, ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { resolveSignInPath } from '@/lib/tenant';
import { useTenantPaths } from '@/lib/useTenantPaths';

const GET_PRINCIPAL_DASHBOARD = gql`
  query GetPrincipalDashboard {
    allStudents {
      totalCount
    }
    allTeachers {
      totalCount
    }
    allClasses {
      nodes {
        id
        name
        studentsByClassId {
          totalCount
        }
      }
    }
    allFees {
      nodes {
        amount
        status
      }
    }
  }
`;

function PrincipalDashboardContent() {
    const router = useRouter();
    const { to } = useTenantPaths();
    const [user, setUser] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState(null);
    const { loading, data } = useQuery(GET_PRINCIPAL_DASHBOARD);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'principal') {
            router.push(resolveSignInPath());
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleGenerateReport = async (type) => {
        setIsGenerating(true);
        setReport(null);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/ai/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const data = await res.json();
            setReport(data);
            toast.success('Report generated successfully!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate report');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!user || loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    const students = data?.allStudents?.totalCount || 0;
    const teachers = data?.allTeachers?.totalCount || 0;
    const classes = data?.allClasses?.nodes || [];
    const fees = data?.allFees?.nodes || [];

    // Calculate fee statistics
    const totalFees = fees.reduce((sum, fee) => sum + parseFloat(fee.amount), 0);
    const paidFees = fees.filter(f => f.status === 'paid').reduce((sum, fee) => sum + parseFloat(fee.amount), 0);
    const collectionRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0;

    const feeStatusData = [
        { name: 'Paid', value: fees.filter(f => f.status === 'paid').length, color: '#10B981' },
        { name: 'Pending', value: fees.filter(f => f.status === 'pending').length, color: '#F59E0B' },
        { name: 'Overdue', value: fees.filter(f => f.status === 'overdue').length, color: '#EF4444' },
    ];

    // Mock class performance data - in production, fetch from attendance API
    const classPerformanceData = classes.slice(0, 5).map(cls => ({
        name: cls.name,
        attendance: Math.floor(Math.random() * 20) + 80, // Mock: 80-100%
        students: cls.studentsByClassId.totalCount
    }));

    // Alerts based on real data
    const alerts = [];
    if (collectionRate < 80) {
        alerts.push({
            type: 'warning',
            title: 'Fee Collection Alert',
            message: `Collection rate is ${collectionRate}%. Target is 85%+`,
            color: 'yellow'
        });
    }
    if (fees.filter(f => f.status === 'overdue').length > 0) {
        alerts.push({
            type: 'error',
            title: 'Overdue Fees',
            message: `${fees.filter(f => f.status === 'overdue').length} students have overdue payments`,
            color: 'red'
        });
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
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
            {/* Welcome Section */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Principal&apos;s Office</h1>
                    <p className="mt-1 text-sm text-zinc-500 sm:text-base">School-wide overview and analytics for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => router.push(to('/principal/calendar'))}
                        className="min-h-11 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                    >
                        View Calendar
                    </button>
                    <button
                        type="button"
                        onClick={() => handleGenerateReport('monthly')}
                        disabled={isGenerating}
                        className="min-h-11 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Download className="w-4 h-4 inline mr-2" />}
                        Generate Report
                    </button>
                </div>
            </div>

            {/* Executive Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                <motion.div variants={itemVariants} className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-blue-200 rounded-lg">
                            <GraduationCap className="w-6 h-6 text-blue-700" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-blue-600 text-sm font-medium mb-1">Total Students</p>
                    <p className="text-3xl font-bold text-blue-900">{students}</p>
                    <p className="text-xs text-blue-600 mt-2">+12% from last year</p>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-purple-200 rounded-lg">
                            <User className="w-6 h-6 text-purple-700" />
                        </div>
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-purple-600 text-sm font-medium mb-1">Active Teachers</p>
                    <p className="text-3xl font-bold text-purple-900">{teachers}</p>
                    <p className="text-xs text-purple-600 mt-2">All present today</p>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-green-200 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-700" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-green-600 text-sm font-medium mb-1">Fee Collection</p>
                    <p className="text-3xl font-bold text-green-900">${(paidFees / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-green-600 mt-2">{collectionRate}% collected</p>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-orange-200 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-orange-700" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-orange-600 text-sm font-medium mb-1">Avg Attendance</p>
                    <p className="text-3xl font-bold text-orange-900">94%</p>
                    <p className="text-xs text-orange-600 mt-2">+2.5% vs last month</p>
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Class Performance Chart */}
                <motion.div variants={itemVariants} className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-zinc-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900">Class Performance</h3>
                            <p className="text-sm text-zinc-500">Attendance rate by class</p>
                        </div>
                    </div>
                    <div className="h-[min(300px,55vw)] min-h-[220px] w-full min-w-0 sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="name" stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: '12px' }} />
                                <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} style={{ fontSize: '12px' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                <Bar dataKey="attendance" fill="#10B981" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Fee Collection Pie Chart */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100">
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">Fee Status</h3>
                    <p className="text-sm text-zinc-500 mb-6">Payment breakdown</p>
                    <div className="flex-1 min-h-[200px] relative">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                                    {feeStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {feeStatusData.map((item) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-zinc-600 font-medium">{item.name}</span>
                                </div>
                                <span className="font-bold text-zinc-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Action Items & Alerts */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900">Alerts & Actions</h2>
                            <p className="text-sm text-zinc-500">Items requiring attention</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {alerts.length > 0 ? alerts.map((alert, index) => (
                            <div key={index} className={`p-4 bg-${alert.color}-50 border-l-4 border-${alert.color}-500 rounded-r-lg`}>
                                <p className={`font-medium text-${alert.color}-800`}>{alert.title}</p>
                                <p className={`text-sm text-${alert.color}-600 mt-1`}>{alert.message}</p>
                            </div>
                        )) : (
                            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                                <p className="font-medium text-green-800">All Clear!</p>
                                <p className="text-sm text-green-600 mt-1">No critical alerts at this time</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-900">Quick Actions</h2>
                            <p className="text-sm text-zinc-500">Common tasks</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div
                            onClick={() => router.push(to('/principal/calendar'))}
                            className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center space-x-3">
                                <Calendar className="w-5 h-5 text-primary-600" />
                                <div>
                                    <p className="font-medium text-zinc-900">View Calendar</p>
                                    <p className="text-xs text-zinc-500">Manage meetings & events</p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div
                            onClick={() => handleGenerateReport('monthly')}
                            className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center space-x-3">
                                <Download className="w-5 h-5 text-green-600" />
                                <div>
                                    <p className="font-medium text-zinc-900">Generate Reports</p>
                                    <p className="text-xs text-zinc-500">Download school analytics</p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div
                            onClick={() => router.push(to('/admin/users/teachers'))}
                            className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center space-x-3">
                                <Users className="w-5 h-5 text-purple-600" />
                                <div>
                                    <p className="font-medium text-zinc-900">Manage Staff</p>
                                    <p className="text-xs text-zinc-500">View teacher roster</p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Generated Report Display */}
            {report && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-zinc-900">Generated Report</h3>
                        <button onClick={() => setReport(null)} className="text-zinc-400 hover:text-zinc-600">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="bg-zinc-50 p-4 rounded-lg">
                        <h4 className="font-bold text-zinc-800 mb-2">Analysis Summary</h4>
                        <p className="text-sm text-zinc-600 mb-3">{report.summary}</p>
                        {report.insights && (
                            <ul className="space-y-1 mb-3">
                                {report.insights.map((insight, i) => (
                                    <li key={i} className="text-xs text-primary-700 flex items-start">
                                        <span className="mr-2">•</span> {insight}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {report.report_url && (
                            <a href={report.report_url} target="_blank" className="text-sm font-bold text-primary-600 flex items-center hover:underline">
                                <Download className="w-4 h-4 mr-2" /> Download Full PDF
                            </a>
                        )}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

export default function PrincipalPage() {
    return <PrincipalDashboardContent />;
}
