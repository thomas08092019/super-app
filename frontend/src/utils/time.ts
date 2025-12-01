export const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      let safeDateStr = isoString.replace(/(\.\d{3})\d+/, '$1');

      if (!safeDateStr.endsWith('Z') && !safeDateStr.includes('+')) {
        safeDateStr += 'Z';
      }

      return new Date(safeDateStr).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      console.error("Format time error:", e);
      return isoString;
    }
  };