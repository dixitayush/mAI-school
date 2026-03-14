import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a comprehensive dashboard report as PDF
 * @param {Object} data - Dashboard data including stats and charts
 * @returns {void} - Downloads the PDF file
 */
export function generateDashboardReport(data) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Header
    doc.setFillColor(79, 70, 229); // Primary color
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Dashboard Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, pageWidth / 2, 30, { align: 'center' });

    // Reset text color for body
    doc.setTextColor(0, 0, 0);
    let yPosition = 50;

    // Overview Section
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('School Overview', 14, yPosition);
    yPosition += 10;

    // Statistics Table
    const statsData = [
        ['Total Students', (data?.students || 0).toString()],
        ['Active Teachers', (data?.teachers || 0).toString()],
        ['Total Revenue', `$${(data?.revenue || 0).toLocaleString()}`],
        ['Average Attendance', (data?.attendance || '0%').toString()]
    ];

    doc.autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: statsData,
        theme: 'grid',
        headStyles: {
            fillColor: [79, 70, 229],
            fontSize: 11,
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 10,
            cellPadding: 5
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251]
        }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Fee Collection Section
    if (data?.feeBreakdown && data.feeBreakdown.length > 0) {
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Fee Collection Status', 14, yPosition);
        yPosition += 10;

        const feeData = data.feeBreakdown.map(item => [
            item.name,
            item.value.toString(),
            `${((item.value / data.totalFees) * 100).toFixed(1)}%`
        ]);

        doc.autoTable({
            startY: yPosition,
            head: [['Status', 'Count', 'Percentage']],
            body: feeData,
            theme: 'grid',
            headStyles: {
                fillColor: [79, 70, 229],
                fontSize: 11,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251]
            }
        });

        yPosition = doc.lastAutoTable.finalY + 15;
    }

    // Attendance Trends Section
    if (data?.attendanceData && data.attendanceData.length > 0) {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Attendance Trends (Monthly)', 14, yPosition);
        yPosition += 10;

        const attendanceTableData = data.attendanceData.map(item => [
            item.month,
            `${item.rate}%`
        ]);

        doc.autoTable({
            startY: yPosition,
            head: [['Month', 'Attendance Rate']],
            body: attendanceTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [79, 70, 229],
                fontSize: 11,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251]
            }
        });

        yPosition = doc.lastAutoTable.finalY + 15;
    }

    // Footer on last page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
        doc.text(
            'School Management System',
            14,
            pageHeight - 10
        );
    }

    // Save the PDF
    const fileName = `dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}
