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
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
            <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-900">{title}</h2>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        {searchable && (
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm w-full sm:w-64"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportToPDF}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                title="Export PDF"
                            >
                                <span className="text-xs font-bold">PDF</span>
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                title="Export CSV"
                            >
                                <span className="text-xs font-bold">CSV</span>
                            </button>
                        </div>

                        {onAdd && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onAdd}
                                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="font-medium">Add New</span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    {col.header}
                                </th>
                            ))}
                            {(onEdit || onDelete) && (
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    {columns.map((_, colIdx) => (
                                        <td key={colIdx} className="px-6 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="px-6 py-12 text-center">
                                    <div className="text-gray-400">
                                        <p className="text-lg font-medium">No records found</p>
                                        <p className="text-sm mt-1">
                                            {searchTerm ? 'Try adjusting your search' : 'Get started by adding a new record'}
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
                                    transition={{ delay: rowIdx * 0.05 }}
                                    className="hover:bg-gray-50 transition-colors"
                                >
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="px-6 py-4 text-sm text-gray-700">
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {onEdit && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => onEdit(row)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </motion.button>
                                                )}
                                                {onDelete && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => onDelete(row)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </motion.button>
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
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-medium">{filteredData.length}</span> of{' '}
                        <span className="font-medium">{data.length}</span> records
                    </p>
                </div>
            )}
        </motion.div>
    );
}
