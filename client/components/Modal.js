"use client";

import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md', className = '' }) {
    // Callers pass `overflow-visible` when a dropdown inside must spill past the
    // panel (e.g. InvoiceModal's student picker); then the body can't scroll.
    const overflowVisible = className.includes('overflow-visible');
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
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-[6px]"
                        aria-hidden="true"
                    />

                    {/* Full-screen container to center the panel */}
                    <div className="fixed inset-0 flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
                        <Dialog.Panel
                            as={motion.div}
                            // Spring config lives inside animate: a `transition` prop
                            // would be read by Headless UI's DialogPanel as its own
                            // transition flag and throw (no parent <Transition>).
                            initial={{ opacity: 0, scale: 0.96, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } }}
                            exit={{ opacity: 0, scale: 0.97, y: 12, transition: { duration: 0.15 } }}
                            className={`flex w-full ${maxWidth} flex-col rounded-2xl ${overflowVisible ? '' : 'max-h-[calc(100dvh-1.5rem)] overflow-hidden sm:max-h-[calc(100dvh-2rem)]'} border border-zinc-200/90 bg-white text-left align-middle shadow-2xl shadow-zinc-950/20 ${className}`}
                        >
                            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-bold leading-6 tracking-tight text-zinc-900"
                                >
                                    {title}
                                </Dialog.Title>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                    <X className="h-[18px] w-[18px]" />
                                </button>
                            </div>

                            <div className={`px-5 py-5 sm:px-6 ${overflowVisible ? '' : 'scroll-thin min-h-0 flex-1 overflow-y-auto'}`}>
                                {children}
                            </div>
                        </Dialog.Panel>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
}
