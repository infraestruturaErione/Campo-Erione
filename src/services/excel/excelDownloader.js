export const downloadExcel = async (workbook, filename) => {
    try {
        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

        // Append to body to ensure the click is registered correctly by some browsers
        document.body.appendChild(link);
        link.click();

        // Cleanup with a slightly longer delay
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 500);
    } catch (error) {
        console.error('Error during Excel download:', error);
    }
};
