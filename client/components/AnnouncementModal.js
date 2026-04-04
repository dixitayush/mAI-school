"use client";

import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-zinc-100 text-zinc-700' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const audienceOptions = [
    { value: 'all', label: 'Everyone' },
    { value: 'students', label: 'Students Only' },
    { value: 'teachers', label: 'Teachers Only' },
];

export default function AnnouncementModal({ isOpen, onClose, onSubmit, editData = null }) {
    const [form, setForm] = useState({
        title: '',
        content: '',
        priority: 'normal',
        targetAudience: 'all',
    });

    useEffect(() => {
        if (editData) {
            setForm({
                title: editData.title || '',
                content: editData.content || '',
                priority: editData.priority || 'normal',
                targetAudience: editData.targetAudience || 'all',
            });
        } else {
            setForm({ title: '', content: '', priority: 'normal', targetAudience: 'all' });
        }
    }, [editData, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(form);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Megaphone className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">
                                            {editData ? 'Edit Announcement' : 'New Announcement'}
                                        </h2>
                                        <p className="text-white/70 text-sm">
                                            {editData ? 'Update announcement details' : 'Broadcast to your school'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    required
                                    placeholder="e.g. Annual Sports Day"
                                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Content</label>
                                <textarea
                                    value={form.content}
                                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                                    required
                                    rows={4}
                                    placeholder="Write the announcement details..."
                                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Priority & Audience Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white"
                                    >
                                        {priorityOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Target Audience</label>
                                    <select
                                        value={form.targetAudience}
                                        onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white"
                                    >
                                        {audienceOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Preview Badge */}
                            <div className="flex items-center space-x-2 text-sm text-zinc-500">
                                <span>Preview:</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityOptions.find(p => p.value === form.priority)?.color}`}>
                                    {priorityOptions.find(p => p.value === form.priority)?.label}
                                </span>
                                <span className="text-zinc-300">•</span>
                                <span className="text-xs text-zinc-500">
                                    {audienceOptions.find(a => a.value === form.targetAudience)?.label}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-indigo-600 rounded-xl hover:shadow-lg hover:shadow-primary-500/30 transition-all"
                                >
                                    {editData ? 'Save Changes' : 'Publish Announcement'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
