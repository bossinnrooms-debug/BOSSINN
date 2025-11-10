export const formatDate = (date: Date | string | number): string => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatTime = (date: Date | string | number): string => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};