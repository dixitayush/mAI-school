"use client";

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { User, Mail, Lock, BookOpen, Phone, MapPin } from 'lucide-react';

export default function StudentModal({ isOpen, onClose, onSubmit, student = null, classes = [] }) {
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        classId: '',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        parentAddress: ''
    });

    useEffect(() => {
        if (student) {
            setFormData({
                fullName: student.userByUserId?.fullName || '',
                username: student.userByUserId?.username || '',
                email: student.userByUserId?.profileByUserId?.email || '',
                password: '', // Don't populate password for security
                classId: student.classId || '',
                parentName: student.parentByParentId?.fullName || '',
                parentEmail: student.parentByParentId?.email || '',
                parentPhone: student.parentByParentId?.phone || '',
                parentAddress: student.parentByParentId?.address || ''
            });
        } else {
            setFormData({
                fullName: '',
                username: '',
                email: '',
                password: '',
                classId: '',
                parentName: '',
                parentEmail: '',
                parentPhone: '',
                parentAddress: ''
            });
        }
    }, [student, isOpen]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={student ? 'Edit Student' : 'Add New Student'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Student Details */}
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Student Information</h3>
                        <div className="h-px bg-gray-200"></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                disabled={!!student}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 transition-all outline-none"
                                placeholder="johndoe"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    {!student && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required={!student}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <BookOpen className="h-5 w-5 text-gray-400" />
                            </div>
                            <select
                                name="classId"
                                value={formData.classId}
                                onChange={handleChange}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                            >
                                <option value="">Select a class</option>
                                {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Parent Details */}
                    <div className="md:col-span-2 pt-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Parent Information</h3>
                        <div className="h-px bg-gray-200"></div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                name="parentName"
                                value={formData.parentName}
                                onChange={handleChange}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="Parent Name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Phone className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="tel"
                                name="parentPhone"
                                value={formData.parentPhone}
                                onChange={handleChange}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Parent Email</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="email"
                                name="parentEmail"
                                value={formData.parentEmail}
                                onChange={handleChange}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="parent@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MapPin className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                name="parentAddress"
                                value={formData.parentAddress}
                                onChange={handleChange}
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="123 Main St"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-gray-100 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                        {student ? 'Update' : 'Create'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
