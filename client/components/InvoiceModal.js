"use client";

import { useState, useEffect, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { toast } from 'react-hot-toast';

const EMPTY = { amount: '', description: '', dueDate: '', status: 'pending' };

export default function InvoiceModal({ isOpen, onClose, onSubmit, students = [], fee = null }) {
    const isEdit = Boolean(fee);
    const [query, setQuery] = useState('');
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
            setSelectedStudent(students.find((s) => s.id === fee.studentId) || null);
        } else {
            setFormData(EMPTY);
            setSelectedStudent(null);
        }
        setQuery('');
    }, [isOpen, fee, students]);

    const filteredStudents =
        query === ''
            ? students
            : students.filter((student) =>
                student.userByUserId?.fullName
                    .toLowerCase()
                    .replace(/\s+/g, '')
                    .includes(query.toLowerCase().replace(/\s+/g, ''))
            );

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
            setQuery('');
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
            className="overflow-visible" // Allow Combobox dropdown to overflow
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Searchable Student Select */}
                <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                        Student *
                    </label>
                    <Combobox value={selectedStudent} onChange={setSelectedStudent}>
                        <div className="relative mt-1">
                            <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-zinc-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent sm:text-sm">
                                <Combobox.Input
                                    className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-zinc-900 focus:ring-0 outline-none"
                                    displayValue={(student) => student?.userByUserId?.fullName || ''}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search for a student..."
                                    required
                                />
                                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                    <ChevronsUpDown
                                        className="h-5 w-5 text-zinc-400"
                                        aria-hidden="true"
                                    />
                                </Combobox.Button>
                            </div>
                            <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                                afterLeave={() => setQuery('')}
                            >
                                <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50">
                                    {filteredStudents.length === 0 && query !== '' ? (
                                        <div className="relative cursor-default select-none py-2 px-4 text-zinc-700">
                                            Nothing found.
                                        </div>
                                    ) : (
                                        filteredStudents.map((student) => (
                                            <Combobox.Option
                                                key={student.id}
                                                className={({ active }) =>
                                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-primary-600 text-white' : 'text-zinc-900'
                                                    }`
                                                }
                                                value={student}
                                            >
                                                {({ selected, active }) => (
                                                    <>
                                                        <span
                                                            className={`block truncate ${selected ? 'font-medium' : 'font-normal'
                                                                }`}
                                                        >
                                                            {student.userByUserId?.fullName}
                                                            <span className={`ml-2 text-xs ${active ? 'text-primary-200' : 'text-zinc-500'}`}>
                                                                ({student.classByClassId?.name || 'No Class'})
                                                            </span>
                                                        </span>
                                                        {selected ? (
                                                            <span
                                                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-primary-600'
                                                                    }`}
                                                            >
                                                                <Check className="h-5 w-5" aria-hidden="true" />
                                                            </span>
                                                        ) : null}
                                                    </>
                                                )}
                                            </Combobox.Option>
                                        ))
                                    )}
                                </Combobox.Options>
                            </Transition>
                        </div>
                    </Combobox>
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
