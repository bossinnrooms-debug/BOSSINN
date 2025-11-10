import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Payment {
  timestamp: Date;
  amount: number;
  mode?: string;
  paymentMode?: string;
  type: string;
}

interface PaymentCalendarProps {
  payments: Payment[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const PaymentCalendar: React.FC<PaymentCalendarProps> = ({ 
  payments, 
  selectedDate, 
  onSelectDate 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Array<{
    date: Date;
    isCurrentMonth: boolean;
    hasPayments: boolean;
    cashAmount: number;
    gpayAmount: number;
  }>>([]);

  useEffect(() => {
    const generateCalendarDays = () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDay.getDay();
      
      const days = [];
      
      // Previous month days
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthLastDay - i);
        const { cash, gpay } = getPaymentBreakdownForDate(date);
        days.push({
          date,
          isCurrentMonth: false,
          hasPayments: cash > 0 || gpay > 0,
          cashAmount: cash,
          gpayAmount: gpay
        });
      }
      
      // Current month days
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const { cash, gpay } = getPaymentBreakdownForDate(date);
        days.push({
          date,
          isCurrentMonth: true,
          hasPayments: cash > 0 || gpay > 0,
          cashAmount: cash,
          gpayAmount: gpay
        });
      }
      
      // Next month days
      const remainingDays = 42 - days.length; // Always show 6 weeks
      for (let day = 1; day <= remainingDays; day++) {
        const date = new Date(year, month + 1, day);
        const { cash, gpay } = getPaymentBreakdownForDate(date);
        days.push({
          date,
          isCurrentMonth: false,
          hasPayments: cash > 0 || gpay > 0,
          cashAmount: cash,
          gpayAmount: gpay
        });
      }
      
      setCalendarDays(days);
    };
    
    generateCalendarDays();
  }, [currentMonth, payments]);

  const getPaymentBreakdownForDate = (date: Date) => {
    let cash = 0;
    let gpay = 0;

    payments.forEach(payment => {
      const paymentDate = payment.timestamp instanceof Date ? 
        payment.timestamp : 
        new Date(payment.timestamp);
        
      if (
        paymentDate.getDate() === date.getDate() &&
        paymentDate.getMonth() === date.getMonth() &&
        paymentDate.getFullYear() === date.getFullYear()
      ) {
        const amount = parseFloat(payment.amount.toString()) || 0;
        if (payment.mode === 'cash' || payment.paymentMode === 'cash') {
          cash += amount;
        } else if (payment.mode === 'gpay' || payment.paymentMode === 'gpay') {
          gpay += amount;
        }
      }
    });

    return { cash, gpay };
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    onSelectDate(new Date());
  };

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-800">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={goToPreviousMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            Today
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
        
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => onSelectDate(day.date)}
            className={`
              relative h-28 p-1 bg-white hover:bg-gray-50 focus:z-10 focus:outline-none
              ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
              ${isSelectedDate(day.date) ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
              ${isToday(day.date) && !isSelectedDate(day.date) ? 'border border-blue-500' : ''}
            `}
          >
            <time
              dateTime={day.date.toISOString().split('T')[0]}
              className={`
                ml-1 flex h-6 w-6 items-center justify-center rounded-full
                ${isSelectedDate(day.date)
                  ? 'bg-blue-600 font-semibold text-white'
                  : isToday(day.date)
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-900'}
              `}
            >
              {day.date.getDate()}
            </time>
            
            {day.hasPayments && (
              <div className="mt-1 space-y-1 text-left">
                {day.cashAmount > 0 && (
                  <div className={`
                    text-xs px-1.5 py-0.5 rounded
                    ${day.isCurrentMonth ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                  `}>
                    ₹{day.cashAmount.toFixed(0)} cash
                  </div>
                )}
                
                {day.gpayAmount > 0 && (
                  <div className={`
                    text-xs px-1.5 py-0.5 rounded
                    ${day.isCurrentMonth ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}
                  `}>
                    ₹{day.gpayAmount.toFixed(0)} gpay
                  </div>
                )}
                
                <div className={`
                  text-xs px-1.5 py-0.5 rounded font-medium
                  ${day.isCurrentMonth ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}
                `}>
                  ₹{(day.cashAmount + day.gpayAmount).toFixed(0)} total
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PaymentCalendar;
