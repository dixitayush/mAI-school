"use client";

import { Edit, Trash2, Plus, Search, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

export default function DataTable({
    title,
    columns,
    data,
    onAdd,
    onEdit,
    onDelete,
    isLoading,
    searchable = true
}) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = searchable && searchTerm
        ? data.filter(row =>
            columns.some(col => {
                const value = col.render ? col.render(row) : row[col.accessor];
                return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
            })
        )
        : data;

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text(title, 14, 15);

        const tableColumn = columns.map(col => col.header);
        const tableRows = [];

        filteredData.forEach(row => {
            const rowData = columns.map(col => {
                const val = col.render ? col.render(row) : row[col.accessor];
                // Strip HTML tags if render returns JSX (simple approximation)
                if (typeof val === 'object' && val !== null) {
                    // Try to extract text from React element if possible, or fallback
                    return val.props?.children || '';
                }
                return val;
            });
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_export.pdf`);
    };

    const exportToCSV = () => {
        const headers = columns.map(col => col.header).join(',');
        const rows = filteredData.map(row =>
            columns.map(col => {
                let val = col.render ? col.render(row) : row[col.accessor];
                // Simple cleanup for CSV
                if (typeof val === 'object' && val !== null) {
                    val = val.props?.children || '';
                }
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(',')
        );

        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden"
        >
            <div className="border-b border-zinc-100 bg-white p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <h2 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">{title}</h2>

                    <div className="flex flex-col items-stretch gap-3 xs:flex-row xs:flex-wrap xs:items-center">
                        {searchable && (
                            <div className="relative w-full sm:w-auto group">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm w-full sm:w-64 bg-zinc-50 focus:bg-white"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportToPDF}
                                className="p-2 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-colors border border-zinc-200"
                                title="Export PDF"
                            >
                                <span className="text-xs font-bold px-1">PDF</span>
                            </button>
                        </div>

                        {onAdd && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onAdd}
                                className="flex items-center space-x-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/30 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="font-semibold text-sm">Add New</span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full min-w-[640px] text-left sm:min-w-0">
                    <thead className="bg-zinc-50/50">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6 sm:py-4 sm:text-xs">
                                    {col.header}
                                </th>
                            ))}
                            {(onEdit || onDelete) && (
                                <th className="sticky right-0 whitespace-nowrap bg-zinc-50/95 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur-sm sm:static sm:bg-transparent sm:px-6 sm:py-4 sm:text-xs">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    {columns.map((_, colIdx) => (
                                        <td key={colIdx} className="px-3 py-3 sm:px-6 sm:py-4">
                                            <div className="h-4 w-3/4 rounded-lg bg-zinc-100"></div>
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-3 py-3 sm:px-6 sm:py-4">
                                            <div className="ml-auto h-4 w-16 rounded-lg bg-zinc-100"></div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="px-6 py-12 text-center">
                                    <div className="text-zinc-400 flex flex-col items-center">
                                        <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-3">
                                            <Search className="w-6 h-6 text-zinc-300" />
                                        </div>
                                        <p className="text-lg font-medium text-zinc-900">No records found</p>
                                        <p className="text-sm mt-1 text-zinc-500">
                                            {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding a new record'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row, rowIdx) => (
                                <motion.tr
                                    key={row.id || rowIdx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: rowIdx * 0.03 }}
                                    className="hover:bg-zinc-50/80 transition-colors group"
                                >
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="max-w-[200px] px-3 py-3 text-sm font-medium text-zinc-700 sm:max-w-none sm:whitespace-nowrap sm:px-6 sm:py-4">
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="sticky right-0 bg-white/95 px-3 py-3 text-right backdrop-blur-sm sm:static sm:bg-transparent sm:px-6 sm:py-4">
                                            <div className="flex items-center justify-end space-x-1 opacity-100 transition-opacity sm:space-x-2 sm:opacity-0 sm:group-hover:opacity-100">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(row)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(row)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && filteredData.length > 0 && (
                <div className="px-6 py-4 bg-zinc-50/30 border-t border-zinc-100 flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-500">
                        Showing <span className="text-zinc-900">{filteredData.length}</span> results
                    </p>
                    {/* Placeholder for future pagination */}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50" disabled>Previous</button>
                        <button type="button" className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50" disabled>Next</button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
