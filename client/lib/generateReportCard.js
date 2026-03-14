import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate a comprehensive student report card as PDF
 * @param {Object} studentData - Student data including personal info, marks, and attendance
 * @returns {void} - Downloads the PDF file
 */
export function generateReportCard(studentData) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Header with school branding
    doc.setFillColor(79, 70, 229); // Primary color
    doc.rect(0, 0, pageWidth, 50, 'F');

    // School Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont(undefined, 'bold');
    doc.text('MAI School', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(18);
    doc.text('Student Report Card', pageWidth / 2, 35, { align: 'center' });

    // Academic Year
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const currentYear = new Date().getFullYear();
    doc.text(`Academic Year ${currentYear - 1}-${currentYear}`, pageWidth / 2, 45, { align: 'center' });

    // Reset text color for body
    doc.setTextColor(0, 0, 0);
    let yPosition = 60;

    // Student Information Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Student Information', 14, yPosition);
    yPosition += 8;

    const studentInfo = [
        ['Student Name', studentData.name || 'N/A'],
        ['Class', studentData.class || 'N/A'],
        ['Roll Number', studentData.rollNumber || 'N/A'],
        ['Academic Year', `${currentYear - 1}-${currentYear}`]
    ];

    doc.autoTable({
        startY: yPosition,
        body: studentInfo,
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: 3
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40 },
            1: { cellWidth: 'auto' }
        }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Academic Performance Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Academic Performance', 14, yPosition);
    yPosition += 8;

    // Marks Table
    const marksData = (studentData.results || []).map(result => {
        const percentage = result.totalMarks > 0
            ? ((result.marksObtained / result.totalMarks) * 100).toFixed(1)
            : '0.0';
        return [
            result.subject,
            result.marksObtained.toString(),
            result.totalMarks.toString(),
            percentage + '%',
            result.grade || calculateGrade(percentage)
        ];
    });

    // Add summary row if there are results
    if (marksData.length > 0) {
        const totalObtained = studentData.results.reduce((sum, r) => sum + r.marksObtained, 0);
        const totalMax = studentData.results.reduce((sum, r) => sum + r.totalMarks, 0);
        const overallPercentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '0.0';

        marksData.push([
            'TOTAL',
            totalObtained.toString(),
            totalMax.toString(),
            overallPercentage + '%',
            calculateGrade(overallPercentage)
        ]);
    }

    doc.autoTable({
        startY: yPosition,
        head: [['Subject', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade']],
        body: marksData.length > 0 ? marksData : [['No exam results available', '', '', '', '']],
        theme: 'grid',
        headStyles: {
            fillColor: [79, 70, 229],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251]
        },
        didParseCell: function (data) {
            // Highlight the total row
            if (data.row.index === marksData.length - 1 && marksData.length > 1) {
                data.cell.styles.fillColor = [226, 232, 240];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
    }

    // Attendance Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Attendance Summary', 14, yPosition);
    yPosition += 8;

    const attendanceData = [
        ['Total Days', (studentData.totalDays || 0).toString()],
        ['Present', (studentData.presentDays || 0).toString()],
        ['Absent', (studentData.absentDays || 0).toString()],
        ['Attendance Percentage', (studentData.attendancePercentage || '0') + '%']
    ];

    doc.autoTable({
        startY: yPosition,
        body: attendanceData,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 4
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60, fillColor: [243, 244, 246] },
            1: { cellWidth: 'auto', halign: 'center' }
        }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Overall Grade and Remarks
    if (studentData.overallGrade || studentData.remarks) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Overall Performance', 14, yPosition);
        yPosition += 8;

        if (studentData.overallGrade) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Grade: ${studentData.overallGrade}`, 14, yPosition);
            yPosition += 7;
        }

        if (studentData.remarks) {
            doc.setFont(undefined, 'italic');
            doc.text('Remarks: ' + studentData.remarks, 14, yPosition, {
                maxWidth: pageWidth - 28
            });
            yPosition += 15;
        }
    }

    // Footer with signatures
    const footerY = pageHeight - 40;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);

    doc.text('_________________', 20, footerY + 15);
    doc.text('Class Teacher', 20, footerY + 20);

    doc.text('_________________', pageWidth / 2 - 20, footerY + 15);
    doc.text('Principal', pageWidth / 2 - 20, footerY + 20);

    doc.text(`Issue Date: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}`, pageWidth - 60, footerY + 20);

    // Page number
    doc.setFontSize(8);
    doc.text('Page 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    const fileName = `report-card-${studentData.name?.replace(/\s+/g, '-').toLowerCase() || 'student'}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

/**
 * Calculate grade based on percentage
 * @param {number|string} percentage 
 * @returns {string} grade
 */
function calculateGrade(percentage) {
    const percent = parseFloat(percentage);
    if (percent >= 90) return 'A+';
    if (percent >= 80) return 'A';
    if (percent >= 70) return 'B+';
    if (percent >= 60) return 'B';
    if (percent >= 50) return 'C';
    if (percent >= 40) return 'D';
    return 'F';
}
