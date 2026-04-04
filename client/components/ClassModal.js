"use client";

import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

export default function ClassModal({ isOpen, onClose, onSubmit, classData, teachers = [] }) {
    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

    useEffect(() => {
        if (isOpen) {
            if (classData) {
                // Edit Mode
                const parts = classData.name.split('-');
                if (parts.length >= 2) {
                    setValue('classLabel', parts[0]);
                    setValue('section', parts[1]);
                } else {
                    setValue('classLabel', classData.name);
                    setValue('section', '');
                }
                setValue('gradeLevel', classData.gradeLevel);
                setValue('teacherId', classData.teacherId || "");
            } else {
                // Create Mode
                reset({
                    name: '',
                    gradeLevel: '',
                    teacherId: ''
                });
            }
        }
    }, [isOpen, classData, reset, setValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                    <h2 className="text-xl font-bold text-zinc-900">
                        {classData ? 'Edit Class' : 'New Class'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                    {/* Class Name (Combined Name & Section in UI for now, but simple text input) */}
                    {/* User wants "create one option to add the class , section" */}
                    {/* We'll use two inputs and combine them, or just descriptive label */}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-zinc-700">Class Label</label>
                            <input
                                {...register('classLabel', { required: 'Class label is required' })}
                                placeholder="e.g. 10"
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                            />
                            {errors.classLabel && <p className="text-xs text-red-500 font-medium">{errors.classLabel.message}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-zinc-700">Section</label>
                            <input
                                {...register('section', { required: 'Section is required' })}
                                placeholder="e.g. A"
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                            />
                            {errors.section && <p className="text-xs text-red-500 font-medium">{errors.section.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-700">Grade Level (Numeric)</label>
                        <input
                            type="number"
                            {...register('gradeLevel', { required: 'Grade level is required' })}
                            placeholder="e.g. 10"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                        />
                        {errors.gradeLevel && <p className="text-xs text-red-500 font-medium">{errors.gradeLevel.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-700">Class Teacher</label>
                        <select
                            {...register('teacherId')}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all bg-white"
                        >
                            <option value="">Select Teacher</option>
                            {teachers.map((t) => (
                                <option key={t.id} value={t.userByUserId?.id}>
                                    {t.userByUserId?.fullName} ({t.userByUserId?.username})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 rounded-xl transition-colors mr-3"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/30 transition-all flex items-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Class
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
