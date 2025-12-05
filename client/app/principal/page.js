"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApolloWrapper } from '@/components/ApolloWrapper';
import { BarChart3, FileText, TrendingUp, AlertTriangle, Loader2, Download, DollarSign, User } from 'lucide-react';

function PrincipalDashboardContent() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'principal') {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleGenerateReport = async (type) => {
        setIsGenerating(true);
        setReport(null);

        try {
            const res = await fetch('http://localhost:5000/api/ai/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const data = await res.json();
            setReport(data);
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Principal Office</h1>
                    <p className="text-gray-500">Welcome, {user.full_name}</p>
                </div>
                <button onClick={handleLogout} className="text-red-600 hover:text-red-700 font-medium">
                    Logout
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-800">Avg Attendance</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">94%</p>
                    <p className="text-sm text-green-600 flex items-center mt-1">
                        <TrendingUp className="w-4 h-4 mr-1" /> +2.5% vs last month
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-800">Fee Collection</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">$45,200</p>
                    <p className="text-sm text-gray-500 mt-1">85% of total dues collected</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <User className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-800">Active Teachers</h3>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">42</p>
                    <p className="text-sm text-gray-500 mt-1">All present today</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Smart Reports</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-800">Academic Performance</h3>
                                    <p className="text-sm text-gray-500">Analyze student grades and trends</p>
                                </div>
                                <button
                                    onClick={() => handleGenerateReport('student_performance')}
                                    disabled={isGenerating}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
                                </button>
                            </div>

                            {report && (
                                <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h4 className="font-bold text-gray-800 mb-2">Analysis Summary</h4>
                                    <p className="text-sm text-gray-600 mb-3">{report.summary}</p>
                                    <ul className="space-y-1 mb-3">
                                        {report.insights.map((insight, i) => (
                                            <li key={i} className="text-xs text-indigo-700 flex items-start">
                                                <span className="mr-2">•</span> {insight}
                                            </li>
                                        ))}
                                    </ul>
                                    <a href={report.report_url} target="_blank" className="text-xs font-bold text-indigo-600 flex items-center hover:underline">
                                        <Download className="w-3 h-3 mr-1" /> Download Full PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Action Items</h2>
                    </div>
                    <div className="space-y-3">
                        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <p className="font-medium text-red-800">Low Attendance Alert</p>
                            <p className="text-sm text-red-600">Class 9-B has dropped below 85% attendance this week.</p>
                        </div>
                        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                            <p className="font-medium text-yellow-800">Fee Payment Reminder</p>
                            <p className="text-sm text-yellow-600">15 students have overdue fees greater than $500.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PrincipalPage() {
    return (
        <ApolloWrapper>
            <PrincipalDashboardContent />
        </ApolloWrapper>
    );
}
