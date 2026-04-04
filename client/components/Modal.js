"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md', className = '' }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <Dialog
                    as={motion.div}
                    static
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    open={isOpen}
                    onClose={onClose}
                    className="relative z-50"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Full-screen container to center the panel */}
                    <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
                        <Dialog.Panel
                            as={motion.div}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className={`w-full ${maxWidth} transform rounded-3xl border border-zinc-200/90 bg-white p-6 text-left align-middle shadow-xl shadow-zinc-200/50 ring-1 ring-zinc-100 transition-all ${className}`}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-bold leading-6 text-zinc-900"
                                >
                                    {title}
                                </Dialog.Title>
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="mt-2">
                                {children}
                            </div>
                        </Dialog.Panel>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
}
