"use client";

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';
import { toast } from 'react-hot-toast';
import StudentPicker from "@/components/StudentPicker";

const EMPTY = { amount: '', description: '', dueDate: '', status: 'pending' };

export default function InvoiceModal({ isOpen, onClose, onSubmit, fee = null }) {
    const isEdit = Boolean(fee);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [formData, setFormData] = useState(EMPTY);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (fee) {
            setFormData({
                amount: fee.amount ?? '',
                description: fee.description ?? '',
                dueDate: fee.dueDate ?? '',
                status: fee.status ?? 'pending',
            });
            setSelectedStudent(fee.studentId ? { id: fee.studentId } : null);
        } else {
            setFormData(EMPTY);
            setSelectedStudent(null);
        }
    }, [isOpen, fee]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudent) {
            toast.error('Please select a student');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                studentId: selectedStudent.id,
                // Invoice numbers are immutable once issued.
                invoiceNumber: fee?.invoiceNumber ?? `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                // Ensure amount is a string for BigDecimal
                amount: formData.amount.toString()
            });

            setFormData(EMPTY);
            setSelectedStudent(null);
        } catch (error) {
            console.error("Error submitting invoice:", error);
            toast.error("Error submitting invoice");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Invoice' : 'Create New Invoice'}
            className="overflow-visible" // let the student picker list overflow the modal
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Searchable Student Select */}
                <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Student *
                    </label>
                    <StudentPicker
                        label={null}
                        required
                        value={selectedStudent?.id || ''}
                        onChange={(id, student) => setSelectedStudent(student || (id ? { id } : null))}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Amount *
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-zinc-500 sm:text-sm">₹</span>
                        </div>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            required
                            min="0"
                            step="0.01"
                            className="w-full pl-7 px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Description *
                    </label>
                    <input
                        type="text"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                        placeholder="Tuition Fee - Term 1"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                            Due Date *
                        </label>
                        <input
                            type="date"
                            name="dueDate"
                            value={formData.dueDate}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                            Status
                        </label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none bg-white"
                        >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>
                </div>

                <div className="flex space-x-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isSubmitting
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : isEdit ? 'Save Changes' : 'Create Invoice'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
