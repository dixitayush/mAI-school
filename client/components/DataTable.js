"use client";

import { Edit, Trash2, Plus, Search, X, Download, FileText, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { PageButtons } from '@/components/Pagination';

const DEFAULT_PAGE_SIZE = 10;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Compare two cell values: numbers numerically, blanks last, text naturally. */
function compareValues(a, b) {
    const emptyA = a === null || a === undefined || a === '';
    const emptyB = b === null || b === undefined || b === '';
    if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return collator.compare(String(a), String(b));
}

export default function DataTable({
    title,
    columns,
    data,
    onAdd,
    onEdit,
    onDelete,
    isLoading,
    searchable = true,
    pageSize = DEFAULT_PAGE_SIZE,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    // { index, dir: 'asc' | 'desc' } — only columns with an accessor sort.
    const [sort, setSort] = useState(null);
    const rows = Array.isArray(data) ? data : [];

    const filteredData = useMemo(() => {
        if (!searchable || !searchTerm.trim()) return rows;
        const q = searchTerm.toLowerCase();
        return rows.filter(row =>
            columns.some(col => {
                const value = col.render ? col.render(row) : row[col.accessor];
                return value?.toString().toLowerCase().includes(q);
            })
        );
    }, [rows, columns, searchable, searchTerm]);

    const sortedData = useMemo(() => {
        const col = sort && columns[sort.index];
        if (!col?.accessor) return filteredData;
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...filteredData].sort((a, b) => dir * compareValues(a[col.accessor], b[col.accessor]));
    }, [filteredData, columns, sort]);

    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const currentPage = Math.min(page, totalPages);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, pageSize, rows.length, sort]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pageStart = sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize;
    const pageEnd = Math.min(pageStart + pageSize, sortedData.length);
    const pageRows = sortedData.slice(pageStart, pageEnd);
    const hasActions = Boolean(onEdit || onDelete);
    const colSpan = columns.length + (hasActions ? 1 : 0);

    // Sort only on accessors that hold real values (not placeholder keys like
    // 'actions' whose cell is entirely render-driven). `sortable: false` opts out.
    const sortableCols = useMemo(
        () => columns.map((col) => Boolean(
            col.accessor && col.sortable !== false &&
            rows.some((r) => r[col.accessor] !== undefined && r[col.accessor] !== null && typeof r[col.accessor] !== 'object')
        )),
        [columns, rows]
    );

    const toggleSort = (index) => {
        setSort((s) => {
            if (!s || s.index !== index) return { index, dir: 'asc' };
            if (s.dir === 'asc') return { index, dir: 'desc' };
            return null;
        });
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text(title, 14, 15);

        const tableColumn = columns.map(col => col.header);
        const tableRows = [];

        sortedData.forEach(row => {
            const rowData = columns.map(col => {
                const val = col.render ? col.render(row) : row[col.accessor];
                if (typeof val === 'object' && val !== null) {
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
        const csvRows = sortedData.map(row =>
            columns.map(col => {
                let val = col.render ? col.render(row) : row[col.accessor];
                if (typeof val === 'object' && val !== null) {
                    val = val.props?.children || '';
                }
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(',')
        );

        const csvContent = [headers, ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}_export.csv`);
    };

    const menuItemClass = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-700 data-[focus]:bg-zinc-100 data-[focus]:text-zinc-900';

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-soft"
        >
            <div className="border-b border-zinc-100 p-4 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <h2 className="truncate text-base font-bold tracking-tight text-zinc-900 sm:text-lg">{title}</h2>
                        {!isLoading && (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                                {searchTerm ? `${sortedData.length} / ${rows.length}` : rows.length}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col items-stretch gap-2.5 xs:flex-row xs:flex-wrap xs:items-center">
                        {searchable && (
                            <div className="group relative w-full sm:w-auto">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary-600" />
                                <input
                                    type="text"
                                    placeholder="Search…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Escape' && setSearchTerm('')}
                                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-9 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 hover:border-zinc-300 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-500/15 sm:w-64"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        aria-label="Clear search"
                                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        <Menu as="div" className="relative">
                            <MenuButton className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 data-[open]:bg-zinc-50 xs:w-auto">
                                <Download className="h-4 w-4" />
                                Export
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                            </MenuButton>
                            <MenuItems
                                transition
                                anchor="bottom end"
                                className="z-50 w-48 origin-top-right rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10 outline-none transition duration-150 ease-out [--anchor-gap:6px] data-[closed]:scale-95 data-[closed]:opacity-0"
                            >
                                <MenuItem>
                                    <button type="button" onClick={exportToPDF} className={menuItemClass}>
                                        <FileText className="h-4 w-4 text-red-500" /> Export as PDF
                                    </button>
                                </MenuItem>
                                <MenuItem>
                                    <button type="button" onClick={exportToCSV} className={menuItemClass}>
                                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export as CSV
                                    </button>
                                </MenuItem>
                            </MenuItems>
                        </Menu>

                        {onAdd && (
                            <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onAdd}
                                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700"
                            >
                                <Plus className="h-4 w-4" />
                                Add New
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            <div className="scroll-thin max-h-[70vh] overflow-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full min-w-[640px] text-left sm:min-w-0">
                    <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur">
                        <tr className="border-b border-zinc-200/70">
                            {columns.map((col, idx) => {
                                const sortable = sortableCols[idx];
                                const active = sort?.index === idx;
                                const SortIcon = active ? (sort.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                                return (
                                    <th
                                        key={idx}
                                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                                        className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-6"
                                    >
                                        {sortable ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleSort(idx)}
                                                className={`group -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-wider transition hover:text-zinc-900 ${active ? 'text-zinc-900' : ''}`}
                                            >
                                                {col.header}
                                                <SortIcon className={`h-3.5 w-3.5 transition ${active ? 'text-primary-600' : 'text-zinc-300 group-hover:text-zinc-500'}`} />
                                            </button>
                                        ) : (
                                            col.header
                                        )}
                                    </th>
                                );
                            })}
                            {hasActions && (
                                <th className="sticky right-0 whitespace-nowrap bg-zinc-50/95 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:static sm:bg-transparent sm:px-6">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {isLoading ? (
                            Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
                                <tr key={idx}>
                                    {columns.map((_, colIdx) => (
                                        <td key={colIdx} className="px-3 py-4 sm:px-6">
                                            <div className="skeleton h-4" style={{ width: `${55 + ((idx * 7 + colIdx * 13) % 35)}%` }} />
                                        </td>
                                    ))}
                                    {hasActions && (
                                        <td className="px-3 py-4 sm:px-6">
                                            <div className="skeleton ml-auto h-4 w-16" />
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="relative mb-4">
                                            <div className="absolute inset-0 scale-150 rounded-full bg-primary-100/60 blur-xl" />
                                            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                                                {searchTerm ? <Search className="h-6 w-6 text-zinc-400" /> : <Inbox className="h-6 w-6 text-zinc-400" />}
                                            </div>
                                        </div>
                                        <p className="text-base font-semibold text-zinc-900">No records found</p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding a new record'}
                                        </p>
                                        {searchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="mt-4 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
                                            >
                                                Clear search
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pageRows.map((row, rowIdx) => (
                                <tr
                                    key={row.id || `${pageStart + rowIdx}`}
                                    className="group transition-colors hover:bg-zinc-50/80"
                                >
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="max-w-[200px] px-3 py-3.5 text-sm font-medium text-zinc-700 sm:max-w-none sm:whitespace-nowrap sm:px-6">
                                            {col.render ? col.render(row) : row[col.accessor]}
                                        </td>
                                    ))}
                                    {hasActions && (
                                        <td className="sticky right-0 bg-white/95 px-3 py-3 text-right backdrop-blur-sm sm:static sm:bg-transparent sm:px-6">
                                            <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(row)}
                                                        className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-primary-50 hover:text-primary-700"
                                                        title="Edit"
                                                        aria-label="Edit"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(row)}
                                                        className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                        title="Delete"
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && sortedData.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-xs font-medium text-zinc-500">
                        Showing{' '}
                        <span className="font-semibold text-zinc-900">{pageStart + 1}–{pageEnd}</span>
                        {' '}of{' '}
                        <span className="font-semibold text-zinc-900">{sortedData.length}</span>
                        {' '}results
                    </p>
                    {totalPages > 1 && (
                        <PageButtons page={currentPage} totalPages={totalPages} onPage={setPage} />
                    )}
                </div>
            )}
        </motion.div>
    );
}
