// Bill.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatDate, formatTime, formatDateTime, parseDateTime } from '../utils/dateUtils';

// Helper function to convert number to words (Indian numbering system)
const numberToWords = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  };

  const intNum = Math.round(Number(num));
  if (intNum === 0) return 'Zero';
  return convert(intNum).trim();
};

const Bill = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [barcode, setBarcode] = useState('');

  // Bill information
  const [billNumber, setBillNumber] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // Customer information
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerGST, setCustomerGST] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerType, setCustomerType] = useState('retail'); // retail, wholesale, bulk, corporate, walk-in
  const [customerDiscount, setCustomerDiscount] = useState(0);

  // Order Reference / Delivery Note (textile-specific, stored in vehicle columns)
  const [orderReference, setOrderReference] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Company information (from selected company)
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [showCompanySelector, setShowCompanySelector] = useState(false);

  // User information (bill created by)
  const [createdBy, setCreatedBy] = useState('');

  // Discount information
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' or 'fixed'
  const [manualDiscount, setManualDiscount] = useState(false); // Track if discount is manually set

  // Tax information
  const [tax, setTax] = useState(0);
  const [taxType, setTaxType] = useState('percentage'); // 'percentage' or 'fixed'

  // Payment information
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('pending');

  // Payment details for different methods
  const [cashReceived, setCashReceived] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');

  // UI states
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [billSaved, setBillSaved] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [lastGeneratedBill, setLastGeneratedBill] = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [savedBillId, setSavedBillId] = useState(null);
  const [fetchingCustomer, setFetchingCustomer] = useState(false);
  const [isDraftInitialized, setIsDraftInitialized] = useState(false);

  // Shop details (defaulting to RV Fashion template)
  const defaultShopDetails = {
    name: 'RV Fashion',
    subtitle: 'RV FASHION TIRUVALLUR',
    subtitle2: 'RV ENTERPRISES',
    address: '#1944, TNHB H.G.ROAD, KAKKALUR BY PASS, KAKKALUR- 602003',
    city: 'Tiruvallur',
    phone: '8220912322 / 9843738588',
    gst: '33GAHPR3113J1ZP',
  };

  const [shopDetails, setShopDetails] = useState(defaultShopDetails);

  // Refs
  const billPaperRef = useRef(null);
  const downloadLinkRef = useRef(null);

  // Create axios instance with credentials
  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Add request interceptor for debugging
  api.interceptors.request.use(request => {
    console.log('Starting Request:', request.url);
    return request;
  });

  // Add response interceptor for error handling
  api.interceptors.response.use(
    response => {
      console.log('Response:', response.status);
      return response;
    },
    error => {
      console.log('Response Error:', error.response?.status, error.response?.data);
      if (error.response?.status === 401) {
        setIsAuthenticated(false);
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      return Promise.reject(error);
    }
  );

  // Base styles (without dynamic values)
  // Base styles (without dynamic values)
  const baseStyles = {
    container: {
      display: 'grid',
      gridTemplateColumns: '1fr 380px',
      gap: '24px',
      padding: '24px 20px',
      minHeight: '100vh',
      background: 'transparent',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    productPanel: {
      background: 'linear-gradient(145deg, #1e293b, #0f172a)',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
      overflow: 'auto',
      maxHeight: 'calc(100vh - 95px)',
    },
    productPanelTitle: {
      marginBottom: '20px',
      color: '#f8fafc',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      paddingBottom: '12px',
      fontSize: '22px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    toastContainer: {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    },
    alert: {
      padding: '10px 16px',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '13px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
      pointerEvents: 'auto',
      maxWidth: '320px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backdropFilter: 'blur(8px)',
      transition: 'all 0.2s ease',
    },
    alertError: {
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    alertSuccess: {
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    searchSection: {
      background: 'rgba(15, 23, 42, 0.7)',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '20px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
    },
    searchBox: {
      marginBottom: '16px',
      position: 'relative',
    },
    searchLabel: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '700',
      color: '#94a3b8',
      fontSize: '12px',
      letterSpacing: '1px',
      textTransform: 'uppercase',
    },
    searchInput: {
      width: '100%',
      padding: '12px 14px',
      background: '#0f172a',
      color: '#f8fafc',
      border: '1.5px solid #334155',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: "'Inter', sans-serif",
      transition: 'all 0.2s ease',
      outline: 'none',
      boxSizing: 'border-box',
    },
    searchLoading: {
      position: 'absolute',
      right: '12px',
      top: '38px',
      color: '#60a5fa',
      fontSize: '13px',
      fontWeight: '600',
    },
    barcodeInput: {
      display: 'flex',
      gap: '10px',
    },
    barcodeField: {
      flex: 1,
      padding: '12px 14px',
      background: '#0f172a',
      color: '#f8fafc',
      border: '1.5px solid #334155',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: "'Courier New', monospace",
      outline: 'none',
      transition: 'all 0.2s ease',
      boxSizing: 'border-box',
    },
    barcodeButton: {
      padding: '12px 22px',
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '14px',
      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
      transition: 'all 0.2s ease',
    },
    barcodeButtonDisabled: {
      background: '#475569',
      boxShadow: 'none',
      cursor: 'not-allowed',
      opacity: 0.6,
    },
    searchResults: {
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '10px',
      maxHeight: '300px',
      overflowY: 'auto',
      marginTop: '4px',
      boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7)',
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      width: '100%',
      zIndex: 1000,
    },
    searchResultItem: {
      padding: '12px 16px',
      borderBottom: '1px solid #334155',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'background 0.2s',
    },
    resultInfo: {
      flex: 1,
    },
    resultName: {
      fontWeight: '600',
      color: '#f8fafc',
      fontSize: '14px',
    },
    resultDetails: {
      fontSize: '12px',
      color: '#94a3b8',
      marginTop: '2px',
    },
    resultPrice: {
      fontWeight: '700',
      color: '#34d399',
      fontSize: '16px',
    },
    selectedProducts: {
      marginTop: '24px',
    },
    selectedProductsTitle: {
      marginBottom: '16px',
      color: '#f8fafc',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      paddingBottom: '10px',
      fontSize: '16px',
      fontWeight: '700',
    },
    noItems: {
      textAlign: 'center',
      color: '#64748b',
      padding: '36px 20px',
      fontStyle: 'normal',
      fontSize: '14px',
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px dashed #334155',
      borderRadius: '12px',
    },
    selectedItemsList: {
      maxHeight: '400px',
      overflowY: 'auto',
    },
    selectedItem: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 120px 90px 36px',
      gap: '10px',
      padding: '12px 14px',
      background: '#0f172a',
      marginBottom: '10px',
      borderRadius: '10px',
      alignItems: 'center',
      border: '1px solid #334155',
      transition: 'all 0.2s ease',
    },
    itemInfo: {
      display: 'flex',
      flexDirection: 'column',
    },
    itemName: {
      fontWeight: '600',
      color: '#f8fafc',
      fontSize: '14px',
    },
    itemModel: {
      fontSize: '11px',
      color: '#94a3b8',
      marginTop: '2px',
    },
    itemPrice: {
      fontWeight: '600',
      color: '#cbd5e1',
      fontSize: '13px',
    },
    itemTotal: {
      fontWeight: '700',
      color: '#34d399',
      fontSize: '14px',
    },
    qtyStepper: {
      display: 'inline-flex',
      alignItems: 'center',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '2px',
      gap: '2px',
    },
    qtyBtnMinus: {
      width: '26px',
      height: '26px',
      borderRadius: '6px',
      border: 'none',
      background: '#334155',
      color: '#f8fafc',
      fontWeight: '700',
      fontSize: '16px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
    },
    qtyBtnPlus: {
      width: '26px',
      height: '26px',
      borderRadius: '6px',
      border: 'none',
      background: 'linear-gradient(135deg, #10b981, #059669)',
      color: '#ffffff',
      fontWeight: '700',
      fontSize: '16px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)',
      transition: 'all 0.15s ease',
    },
    qtyValue: {
      minWidth: '30px',
      textAlign: 'center',
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: '700',
      userSelect: 'none',
    },
    removeBtn: {
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      color: 'white',
      border: 'none',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      cursor: 'pointer',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
    },
    billPanel: {
      background: 'white',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: '80px',
      height: 'fit-content',
      maxHeight: 'calc(100vh - 95px)',
      overflow: 'auto',
    },
    billContainer: {
      padding: '15px',
    },
    billPaper: {
      background: 'white',
      padding: '12px 10px',
      border: '1px solid #ccc',
      boxShadow: '0 0 15px rgba(0,0,0,0.12)',
      position: 'relative',
      marginBottom: '15px',
      borderRadius: '2px',
      width: '300px',
      margin: '0 auto',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      lineHeight: '1.25',
      color: '#000',
    },
    receiptBrand: {
      textAlign: 'center',
      fontSize: '26px',
      fontWeight: '900',
      letterSpacing: '2px',
      fontFamily: "Arial, Helvetica, sans-serif",
      color: '#000',
      lineHeight: '1.1',
      marginBottom: '2px',
    },
    receiptTagline: {
      textAlign: 'center',
      fontSize: '8px',
      letterSpacing: '2px',
      color: '#444',
      marginBottom: '4px',
    },
    receiptSubtitle: {
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: 'bold',
      marginBottom: '2px',
    },
    receiptHeaderP: {
      textAlign: 'center',
      fontSize: '8.5px',
      margin: '1px 0',
      lineHeight: '1.2',
      color: '#000',
    },
    receiptDividerSolid: {
      borderTop: '1px solid #000',
      margin: '4px 0',
    },
    receiptDividerDashed: {
      borderTop: '1px dashed #000',
      margin: '4px 0',
    },
    receiptDividerDotted: {
      borderTop: '1px dotted #000',
      margin: '3px 0',
    },
    receiptSalesInvoice: {
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: 'bold',
      padding: '2px 0',
      margin: '2px 0',
    },
    billHeader: {
      textAlign: 'center',
      marginBottom: '8px',
      paddingBottom: '4px',
    },
    billHeaderH1: {
      fontSize: '16px',
      letterSpacing: '1px',
      marginBottom: '3px',
      color: '#333',
      fontWeight: 'bold',
    },
    billHeaderP: {
      fontSize: '9px',
      color: '#666',
      margin: '1px 0',
      lineHeight: '1.2',
    },
    billInfo: {
      margin: '6px 0',
      padding: '4px 0',
    },
    billInfoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '2px',
      fontSize: '9.5px',
    },
    billNumber: {
      fontWeight: 'bold',
      color: '#000',
    },
    customerSection: {
      margin: '6px 0',
      padding: '6px',
      background: '#f9f9f9',
      borderRadius: '2px',
      border: '1px solid #e9ecef',
    },
    customerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '2px',
      fontSize: '9.5px',
    },
    customerLabel: {
      fontWeight: 'bold',
      color: '#333',
    },
    customerValue: {
      color: '#000',
      maxWidth: '180px',
      textAlign: 'right',
    },
    customerTypeBadge: {
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '9px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    internalBadge: {
      background: '#cce5ff',
      color: '#004085',
    },
    externalBadge: {
      background: '#fff3cd',
      color: '#856404',
    },
    customerInput: {
      width: '100%',
      padding: '4px 6px',
      marginBottom: '4px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      fontFamily: "'Courier New', monospace",
      fontSize: '10px',
      transition: 'border-color 0.3s',
    },
    customerTypeSelect: {
      width: '100%',
      padding: '4px',
      marginBottom: '4px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      fontFamily: "'Courier New', monospace",
      fontSize: '10px',
    },
    billItems: {
      margin: '6px 0',
    },
    billItemsHeader: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
      fontWeight: 'bold',
      padding: '4px 0',
      borderBottom: '1px solid #333',
      fontSize: '10px',
      background: '#f0f0f0',
      paddingLeft: '2px',
    },
    billItem: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
      padding: '3px 0',
      borderBottom: '1px dotted #ccc',
      fontSize: '9px',
      paddingLeft: '2px',
    },
    billItemEmpty: {
      textAlign: 'center',
      color: '#999',
      padding: '10px',
      fontStyle: 'italic',
      fontSize: '10px',
    },
    billItemName: {
      display: 'flex',
      flexDirection: 'column',
    },
    billItemSmall: {
      fontSize: '7px',
      color: '#666',
    },
    billSummary: {
      margin: '10px 0',
      padding: '8px 0',
      borderTop: '1px solid #333',
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '3px',
      fontSize: '10px',
    },
    summaryRowTotal: {
      fontWeight: 'bold',
      fontSize: '12px',
      borderTop: '1px dashed #333',
      paddingTop: '6px',
      marginTop: '6px',
      color: '#333',
    },
    discountSection: {
      margin: '8px 0',
      padding: '6px',
      background: '#f0f7ff',
      borderRadius: '3px',
      border: '1px solid #b8daff',
    },
    discountHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '5px',
      cursor: 'pointer',
    },
    discountTitle: {
      fontWeight: 'bold',
      color: '#004085',
      fontSize: '11px',
    },
    discountToggle: {
      color: '#007bff',
      fontSize: '12px',
    },
    discountControls: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '5px',
      marginTop: '5px',
    },
    discountInput: {
      padding: '4px',
      border: '1px solid #ddd',
      borderRadius: '3px',
      fontFamily: "'Courier New', monospace",
      fontSize: '10px',
      width: '100%',
    },
    discountTypeSelect: {
      padding: '4px',
      border: '1px solid #ddd',
      borderRadius: '3px',
      fontFamily: "'Courier New', monospace",
      fontSize: '10px',
      width: '100%',
    },
    discountAmount: {
      fontSize: '10px',
      color: '#28a745',
      fontWeight: 'bold',
      marginTop: '3px',
    },
    summaryInput: {
      width: '50px',
      padding: '2px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      textAlign: 'right',
      fontFamily: "'Courier New', monospace",
      fontSize: '9px',
      marginLeft: '3px',
    },
    paymentSection: {
      margin: '10px 0',
      padding: '8px',
      background: '#f0f0f0',
      borderRadius: '2px',
      border: '1px solid #ddd',
      fontSize: '10px',
    },
    paymentRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '4px',
      alignItems: 'center',
    },
    paymentSelect: {
      padding: '4px',
      width: '100px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      fontFamily: "'Courier New', monospace",
      fontSize: '9px',
    },
    paymentInput: {
      width: '80px',
      padding: '3px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      textAlign: 'right',
      fontFamily: "'Courier New', monospace",
      fontSize: '9px',
    },
    paymentDetails: {
      marginTop: '8px',
      padding: '6px',
      background: 'white',
      borderRadius: '2px',
      border: '1px solid #ccc',
    },
    paymentDetailsInput: {
      width: '100%',
      padding: '4px',
      marginBottom: '4px',
      border: '1px solid #ddd',
      borderRadius: '2px',
      fontFamily: "'Courier New', monospace",
      fontSize: '9px',
    },
    billFooter: {
      textAlign: 'center',
      marginTop: '15px',
      paddingTop: '10px',
      borderTop: '1px dashed #333',
      fontSize: '8px',
    },
    billFooterP: {
      marginBottom: '2px',
      color: '#666',
    },
    actionButtons: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '8px',
      marginTop: '15px',
    },
    whatsappButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px',
      marginTop: '10px',
      background: '#25D366',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'background 0.3s',
      textDecoration: 'none',
      width: '100%',
    },
    btn: {
      padding: '10px',
      border: 'none',
      borderRadius: '3px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '12px',
      transition: 'all 0.3s',
      fontFamily: "'Courier New', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
    },
    btnDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    btnPrimary: {
      background: '#007bff',
      color: 'white',
    },
    btnSuccess: {
      background: '#28a745',
      color: 'white',
    },
    btnDanger: {
      background: '#dc3545',
      color: 'white',
    },
    btnSecondary: {
      background: '#6c757d',
      color: 'white',
    },
    btnInfo: {
      background: '#17a2b8',
      color: 'white',
    },
    btnWarning: {
      background: '#ffc107',
      color: '#333',
    },
    downloadLink: {
      display: 'none',
    },
    companySelector: {
      marginBottom: '16px',
      padding: '12px 14px',
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '10px',
      cursor: 'pointer',
      color: '#f8fafc',
    },
    companyName: {
      fontWeight: '700',
      color: '#60a5fa',
      fontSize: '14px',
    },
    companyDropdown: {
      marginTop: '8px',
      padding: '6px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      maxHeight: '200px',
      overflowY: 'auto',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    },
    companyOption: {
      padding: '8px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #334155',
      color: '#f8fafc',
      borderRadius: '4px',
      transition: 'background 0.2s',
    },
    companyOptionHover: {
      background: '#334155',
    },
  };

  // Check authentication on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        // Set the name for display and the ID for saving
        setCreatedBy(userData.full_name || userData.name || userData.username || 'System');
      } catch (e) {
        setCreatedBy('System');
      }
    } else {
      setIsAuthenticated(false);
      setError('Please login first');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }, []);

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Fetch companies from API
  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies/list');
      if (response.data && response.data.length > 0) {
        setCompanies(response.data);
        // Auto-select first company if available
        const firstCompany = response.data[0];
        setSelectedCompany(firstCompany);
        fetchCompanyDetails(firstCompany.id);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to fetch companies');
    }
  };

  // Fetch company details by ID
  const fetchCompanyDetails = async (companyId) => {
    try {
      const response = await api.get(`/companies/${companyId}`);
      if (response.data) {
        const company = response.data;
        setShopDetails({
          name: company.name || defaultShopDetails.name,
          address: company.address || defaultShopDetails.address,
          city: company.city || defaultShopDetails.city,
          phone: company.phone || '',
          gst: company.gst_number || '',
        });
      }
    } catch (err) {
      console.error('Error fetching company details:', err);
    }
  };

  // Handle company selection
  const handleCompanySelect = async (company) => {
    setSelectedCompany(company);
    setShowCompanySelector(false);
    await fetchCompanyDetails(company.id);
    setSuccess(`Switched to ${company.name}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  // Generate random bill number (for display only, backend will generate unique)
  const generateBillNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 8; i++) {
      random += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }

    setBillNumber(`RVT-${year}${month}${day}-${random}`);
  };

  // Update date and time
  const updateDateTime = () => {
    const now = new Date();
    setCurrentDate(formatDate(now));
    setCurrentTime(formatTime(now));
  };

  // Initialize and restore draft bill on mount
  useEffect(() => {
    generateBillNumber();
    updateDateTime();

    const savedDraft = localStorage.getItem('active_draft_bill');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.selectedProducts && Array.isArray(draft.selectedProducts) && draft.selectedProducts.length > 0) {
          setSelectedProducts(draft.selectedProducts);
          if (draft.customerName !== undefined) setCustomerName(draft.customerName);
          if (draft.customerPhone !== undefined) setCustomerPhone(draft.customerPhone);
          if (draft.customerEmail !== undefined) setCustomerEmail(draft.customerEmail);
          if (draft.customerGST !== undefined) setCustomerGST(draft.customerGST);
          if (draft.customerAddress !== undefined) setCustomerAddress(draft.customerAddress);
          if (draft.customerType !== undefined) setCustomerType(draft.customerType);
          if (draft.customerDiscount !== undefined) setCustomerDiscount(draft.customerDiscount);
          if (draft.orderReference !== undefined) setOrderReference(draft.orderReference);
          if (draft.deliveryNote !== undefined) setDeliveryNote(draft.deliveryNote);
          if (draft.discount !== undefined) setDiscount(draft.discount);
          if (draft.discountType !== undefined) setDiscountType(draft.discountType);
          if (draft.manualDiscount !== undefined) setManualDiscount(draft.manualDiscount);
          if (draft.tax !== undefined) setTax(draft.tax);
          if (draft.taxType !== undefined) setTaxType(draft.taxType);
          if (draft.paidAmount !== undefined) setPaidAmount(draft.paidAmount);
          if (draft.paymentMethod !== undefined) setPaymentMethod(draft.paymentMethod);
          if (draft.paymentStatus !== undefined) setPaymentStatus(draft.paymentStatus);
          if (draft.cashReceived !== undefined) setCashReceived(draft.cashReceived);
          if (draft.cardNumber !== undefined) setCardNumber(draft.cardNumber);
          if (draft.cardHolderName !== undefined) setCardHolderName(draft.cardHolderName);
          if (draft.upiId !== undefined) setUpiId(draft.upiId);
          if (draft.transactionId !== undefined) setTransactionId(draft.transactionId);
          if (draft.bankName !== undefined) setBankName(draft.bankName);
          if (draft.chequeNumber !== undefined) setChequeNumber(draft.chequeNumber);
          if (draft.billNumber) setBillNumber(draft.billNumber);

          setSuccess('Restored active draft bill!');
          setTimeout(() => setSuccess(''), 2500);
        }
      } catch (err) {
        console.error('Failed to restore draft bill:', err);
      }
    }

    setIsDraftInitialized(true);

    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Save active draft bill to localStorage on state changes
  useEffect(() => {
    if (!isDraftInitialized) return;

    if (selectedProducts.length > 0 || customerPhone || orderReference || (customerName && customerName !== 'Walk-in Customer')) {
      const draftData = {
        selectedProducts,
        customerName,
        customerPhone,
        customerEmail,
        customerGST,
        customerAddress,
        customerType,
        customerDiscount,
        orderReference,
        deliveryNote,
        discount,
        discountType,
        manualDiscount,
        tax,
        taxType,
        paidAmount,
        paymentMethod,
        paymentStatus,
        cashReceived,
        cardNumber,
        cardHolderName,
        upiId,
        transactionId,
        bankName,
        chequeNumber,
        billNumber
      };
      localStorage.setItem('active_draft_bill', JSON.stringify(draftData));
    } else {
      localStorage.removeItem('active_draft_bill');
    }
  }, [
    isDraftInitialized, selectedProducts, customerName, customerPhone, customerEmail,
    customerGST, customerAddress, customerType, customerDiscount, orderReference,
    deliveryNote, discount, discountType, manualDiscount, tax, taxType,
    paidAmount, paymentMethod, paymentStatus, cashReceived, cardNumber,
    cardHolderName, upiId, transactionId, bankName, chequeNumber, billNumber
  ]);

  // Search products with debounce (triggers immediately after typing 1 letter)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        searchProducts();
      } else {
        setSearchResults([]);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Update payment status when paid amount changes
  useEffect(() => {
    const total = calculateTotal();
    if (paidAmount === 0) {
      setPaymentStatus('pending');
    } else if (paidAmount < total) {
      setPaymentStatus('partial');
    } else if (paidAmount >= total) {
      setPaymentStatus('paid');
    }
  }, [paidAmount, selectedProducts, discount, tax, discountType, taxType]);

  // Set discount based on textile customer type (only if not manually set)
  useEffect(() => {
    if (!manualDiscount) {
      if (customerType === 'wholesale') {
        setCustomerDiscount(10);
        setDiscount(10);
        setDiscountType('percentage');
      } else if (customerType === 'bulk') {
        setCustomerDiscount(15);
        setDiscount(15);
        setDiscountType('percentage');
      } else {
        setCustomerDiscount(0);
        setDiscount(0);
        setDiscountType('percentage');
      }
    }
  }, [customerType, manualDiscount]);

  // Add thermal print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        
        #billPaper, #billPaper * {
          visibility: visible !important;
          background: white !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        #billPaper {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 280px !important;
          margin: 0 !important;
          padding: 12px !important;
          border: none !important;
          box-shadow: none !important;
          background: white !important;
        }
        
        #billPaper div,
        #billPaper span,
        #billPaper p,
        #billPaper h1,
        #billPaper h2,
        #billPaper h3,
        #billPaper table,
        #billPaper tr,
        #billPaper td,
        #billPaper th {
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: white !important;
        }
        
        #billPaper .bill-header {
          border-bottom: 1px dashed #000 !important;
        }
        
        #billPaper .bill-info {
          border-top: 1px dashed #000 !important;
          border-bottom: 1px dashed #000 !important;
        }
        
        #billPaper .bill-items-header {
          border-bottom: 1px solid #000 !important;
        }
        
        #billPaper .bill-item {
          border-bottom: 1px dotted #000 !important;
        }
        
        #billPaper .bill-summary {
          border-top: 1px solid #000 !important;
        }
        
        #billPaper .bill-footer {
          border-top: 1px dashed #000 !important;
        }
        
        #billPaper * {
          background: white !important;
          color: black !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        #billPaper input,
        #billPaper select,
        #billPaper button,
        #billPaper .no-print {
          display: none !important;
        }
        
        #billPaper .payment-section {
          display: none !important;
        }
        
        #billPaper .customer-section input,
        #billPaper .customer-section select,
        #billPaper .customer-section button {
          display: none !important;
        }
        
        #billPaper .customer-section {
          border: none !important;
          padding: 0 !important;
          margin: 10px 0 !important;
        }
        
        #billPaper .discount-section {
          display: none !important;
        }
        
        @page {
          size: 80mm auto !important;
          margin: 0 !important;
        }
        
        .no-print {
          display: none !important;
        }
      }
      
      @media screen {
        #billPaper input,
        #billPaper select,
        #billPaper button {
          display: block;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Clear payment method specific fields when method changes
  useEffect(() => {
    setShowPaymentDetails(true);
    switch (paymentMethod) {
      case 'cash':
        setCardNumber('');
        setCardHolderName('');
        setUpiId('');
        setTransactionId('');
        setBankName('');
        setChequeNumber('');
        break;
      case 'card':
        setCashReceived(0);
        setUpiId('');
        setTransactionId('');
        setBankName('');
        setChequeNumber('');
        break;
      case 'upi':
        setCashReceived(0);
        setCardNumber('');
        setCardHolderName('');
        setBankName('');
        setChequeNumber('');
        break;
      case 'cheque':
        setCashReceived(0);
        setCardNumber('');
        setCardHolderName('');
        setUpiId('');
        setTransactionId('');
        break;
      default:
        break;
    }
  }, [paymentMethod]);

  // Fetch customer by phone
  const fetchCustomerByPhone = async (phone) => {
    if (phone.length < 10) return;

    setFetchingCustomer(true);
    try {
      const response = await api.get(`/billing/customer/${phone}`);
      if (response.data && response.data.exists) {
        const customer = response.data.customer;
        setCustomerName(customer.name || 'Walk-in Customer');
        setCustomerEmail(customer.email || '');
        setCustomerAddress(customer.address || '');
        setCustomerGST(customer.gst || '');
        setCustomerType(customer.type || 'retail');
        setSuccess('Customer found! Details auto-filled.');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
    } finally {
      setFetchingCustomer(false);
    }
  };

  // Auto-fetch customer when phone reaches 10 digits
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      fetchCustomerByPhone(cleanPhone);
    }
  }, [customerPhone]);




  // Search products API call
  const searchProducts = async () => {
    if (!isAuthenticated) return;

    setSearchLoading(true);
    setError('');

    try {
      const response = await api.get(`/billing/search-products?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else {
        setError(err.response?.data?.error || 'Failed to search products');
      }
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Get product by product code (SKU lookup)
  const getProductByBarcode = async () => {
    if (!isAuthenticated) return;
    if (!barcode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/billing/product/code/${encodeURIComponent(barcode.trim())}`);
      addProductToBill(response.data);
      setBarcode('');
    } catch (err) {
      console.error('SKU lookup error:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status === 404) {
        setError(`Product code "${barcode}" not found`);
      } else {
        setError(err.response?.data?.error || 'Product not found');
      }
    } finally {
      setLoading(false);
    }
  };

  // Add product to bill
  const addProductToBill = (product) => {
    const existingProduct = selectedProducts.find(p => p.id === product.id);

    if (existingProduct) {
      if (existingProduct.quantity < product.quantity) {
        const updatedProducts = selectedProducts.map(p =>
          p.id === product.id
            ? {
              ...p,
              quantity: p.quantity + 1,
              total: (p.quantity + 1) * p.sellPrice
            }
            : p
        );
        setSelectedProducts(updatedProducts);
        setSuccess(`Added another ${product.name}`);
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(`Insufficient stock! Max available: ${product.quantity}`);
        setTimeout(() => setError(''), 3000);
      }
    } else {
      if (product.quantity > 0) {
        setSelectedProducts([
          ...selectedProducts,
          {
            id: product.id,
            name: product.name,
            productCode: product.productCode || '',
            category: product.category || '',
            unit: product.unit || '',
            sellPrice: product.sellPrice,
            quantity: 1,
            total: product.sellPrice,
            maxQuantity: product.quantity
          }
        ]);
        setSuccess(`${product.name} added to bill`);
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError('Out of stock!');
        setTimeout(() => setError(''), 3000);
      }
    }

    setSearchQuery('');
    setSearchResults([]);
  };

  // Update quantity - Triggers floating toast notification at bottom-right without shifting page layout
  const updateQuantity = (productId, newQuantity) => {
    const product = selectedProducts.find(p => p.id === productId);

    if (product) {
      newQuantity = parseInt(newQuantity) || 0;

      // Allow quantity to be 0
      if (newQuantity >= 0 && newQuantity <= product.maxQuantity) {
        const updatedProducts = selectedProducts.map(p =>
          p.id === productId
            ? { ...p, quantity: newQuantity, total: newQuantity * p.sellPrice }
            : p
        );
        setSelectedProducts(updatedProducts);

        // Show floating bottom-right toast notification (zero layout shifting!)
        if (newQuantity === 0) {
          setSuccess(`Qty set to 0: ${product.name}`);
        } else {
          setSuccess(`Qty updated: ${newQuantity} × ${product.name}`);
        }
        setTimeout(() => setSuccess(''), 1500);
      } else if (newQuantity > product.maxQuantity) {
        setError(`Max stock reached! (${product.maxQuantity} available)`);
        setTimeout(() => setError(''), 2500);
      }
    }
  };

  // Remove product - Only for complete removal (separate function)
  const removeProduct = (productId) => {
    const product = selectedProducts.find(p => p.id === productId);
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
    setSuccess(`${product.name} removed from bill`);
    setTimeout(() => setSuccess(''), 2000);
  };

  // Calculate subtotal (only items with quantity > 0)
  const calculateSubtotal = () => {
    return selectedProducts
      .filter(p => p.quantity > 0)
      .reduce((sum, p) => sum + p.total, 0);
  };

  // Calculate discount amount
  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    if (subtotal === 0) return 0;

    if (discountType === 'percentage') {
      return (subtotal * discount) / 100;
    }
    return Math.min(discount, subtotal); // Fixed amount cannot exceed subtotal
  };

  // Calculate tax amount (applied after discount)
  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const afterDiscount = subtotal - discountAmount;

    if (afterDiscount <= 0) return 0;

    if (taxType === 'percentage') {
      return (afterDiscount * tax) / 100;
    }
    return Math.min(tax, afterDiscount); // Fixed tax cannot exceed after discount amount
  };

  // Calculate total (subtotal - discount + tax)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxAmount = calculateTaxAmount();
    return Math.max(0, subtotal - discountAmount + taxAmount);
  };

  // Calculate change
  const calculateChange = () => {
    const total = calculateTotal();
    return Math.max(0, paidAmount - total);
  };

  // Calculate due amount
  const calculateDue = () => {
    const total = calculateTotal();
    return Math.max(0, total - paidAmount);
  };

  // Handle discount change
  const handleDiscountChange = (value) => {
    setManualDiscount(true); // Mark as manually set
    const numValue = parseFloat(value) || 0;
    const subtotal = calculateSubtotal();

    // Validate based on discount type
    if (discountType === 'percentage') {
      if (numValue > 100) {
        setError('Percentage discount cannot exceed 100%');
        setDiscount(100);
      } else if (numValue < 0) {
        setDiscount(0);
      } else {
        setDiscount(numValue);
      }
    } else {
      if (numValue > subtotal) {
        setError('Fixed discount cannot exceed subtotal');
        setDiscount(subtotal);
      } else if (numValue < 0) {
        setDiscount(0);
      } else {
        setDiscount(numValue);
      }
    }

    // Clear error after 3 seconds
    setTimeout(() => setError(''), 3000);
  };

  // Handle discount type change
  const handleDiscountTypeChange = (type) => {
    setManualDiscount(true); // Mark as manually set
    const subtotal = calculateSubtotal();
    setDiscountType(type);

    // Convert discount value when type changes
    if (type === 'percentage') {
      // If switching to percentage, convert fixed amount to percentage
      if (discountType === 'fixed' && subtotal > 0) {
        const percentage = (discount / subtotal) * 100;
        setDiscount(Math.min(100, Math.round(percentage * 100) / 100));
      } else if (discount > 100) {
        setDiscount(100);
      }
    } else {
      // If switching to fixed, convert percentage to fixed amount
      if (discountType === 'percentage' && subtotal > 0) {
        const fixed = (subtotal * discount) / 100;
        setDiscount(Math.min(subtotal, Math.round(fixed * 100) / 100));
      } else if (discount > subtotal) {
        setDiscount(subtotal);
      }
    }
  };

  // Reset discount to customer default
  const resetDiscountToDefault = () => {
    setManualDiscount(false);
    if (customerType === 'wholesale') {
      setDiscount(10);
      setDiscountType('percentage');
    } else if (customerType === 'bulk') {
      setDiscount(15);
      setDiscountType('percentage');
    } else {
      setDiscount(0);
      setDiscountType('percentage');
    }
  };

  // Handle cash payment
  const handleCashPayment = (received) => {
    const amount = parseFloat(received) || 0;
    setCashReceived(amount);
    setPaidAmount(amount);
  };

  // Handle exact payment
  const handleExactPayment = () => {
    const total = calculateTotal();
    setPaidAmount(total);
    if (paymentMethod === 'cash') {
      setCashReceived(total);
    }
  };

  // Save bill to database
  const saveBillToDatabase = async () => {
    const activeProducts = selectedProducts.filter(p => p.quantity > 0);

    if (activeProducts.length === 0) {
      setError('No items with quantity > 0 to save!');
      return null;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare bill data for API
      const billData = {
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        customerGST: customerGST,
        customerAddress: customerAddress,
        customerType: customerType,
        orderReference: orderReference,
        deliveryNote: deliveryNote,
        companyId: selectedCompany?.id,
        discount: discount,
        discountType: discountType === 'percentage' ? 'percentage' : 'amount',
        tax: tax,
        taxType: taxType === 'percentage' ? 'percentage' : 'amount',
        paidAmount: paidAmount,
        paymentMethod: paymentMethod,
        createdBy: JSON.parse(localStorage.getItem('user'))?.id,
        createdByName: createdBy, // Using the state variable which now has the correct name
        items: activeProducts.map(p => ({
          productId: p.id,
          quantity: p.quantity
        }))
      };

      console.log('Saving bill:', billData);

      const response = await api.post('/billing/bills', billData);

      if (response.data.success) {
        setSuccess('Bill saved successfully!');
        setSavedBillId(response.data.billId);
        setBillNumber(response.data.billNumber); // Update with actual bill number from backend
        setLastGeneratedBill({
          billNumber: response.data.billNumber,
          customerPhone: customerPhone,
          customerName: customerName
        });
        setShowWhatsApp(true);
        setBillSaved(true);
        localStorage.removeItem('active_draft_bill');

        return {
          billId: response.data.billId,
          billNumber: response.data.billNumber
        };
      } else {
        throw new Error(response.data.error || 'Failed to save bill');
      }
    } catch (err) {
      console.error('Save bill error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save bill');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate HTML content for bill with RV Fashion Sales Invoice template
  const generateBillHTML = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxAmount = calculateTaxAmount();
    const total = calculateTotal();
    const due = calculateDue();
    const change = calculateChange();
    const activeProducts = selectedProducts.filter(p => p.quantity > 0);

    const totalQuantity = activeProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
    const totalGrossSale = activeProducts.reduce((sum, p) => sum + ((parseFloat(p.mrp) || parseFloat(p.sellPrice) || 0) * (parseInt(p.quantity) || 0)), 0);
    const promoDiscount = Math.max(0, totalGrossSale - subtotal);
    const totalSavings = promoDiscount + discountAmount;
    const subtotalAfterDisc = Math.max(0, subtotal - discountAmount);
    const taxableAmount = subtotalAfterDisc / 1.18;
    const cgstAmount = taxableAmount * 0.09;
    const sgstAmount = taxableAmount * 0.09;
    const roundOff = 0.00;
    const wordsTotal = numberToWords(total);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Invoice - ${billNumber}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 10px 0;
              width: 80mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              background: #fff;
              line-height: 1.25;
            }
            
            #billPaper {
              width: 280px;
              margin: 0 auto;
              padding: 6px 8px;
              background: white;
            }
            
            .store-brand {
              text-align: center;
              font-size: 26px;
              font-weight: 900;
              letter-spacing: 2px;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              line-height: 1.1;
              margin-bottom: 2px;
            }
            
            .store-tagline {
              text-align: center;
              font-size: 8px;
              letter-spacing: 2px;
              color: #555;
              margin-bottom: 4px;
            }
            
            .store-subtitle, .store-subtitle2 {
              text-align: center;
              font-size: 11px;
              font-weight: bold;
              margin-bottom: 2px;
            }
            
            .store-address, .store-gstin, .store-phone {
              text-align: center;
              font-size: 8.5px;
              margin: 1px 0;
              line-height: 1.2;
            }
            
            .divider-solid {
              border-top: 1px solid #000;
              margin: 4px 0;
            }
            
            .divider-dashed {
              border-top: 1px dashed #000;
              margin: 4px 0;
            }
            
            .divider-dotted {
              border-top: 1px dotted #000;
              margin: 3px 0;
            }
            
            .invoice-title {
              text-align: center;
              font-size: 13px;
              font-weight: bold;
              padding: 2px 0;
              margin: 2px 0;
            }
            
            .invoice-meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              margin: 1px 0;
            }
            
            .customer-meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              margin: 2px 0;
              font-weight: 600;
            }
            
            .items-table {
              width: 100%;
              margin: 4px 0;
            }
            
            .items-head-1, .items-row-1 {
              display: grid;
              grid-template-columns: 18px 75px 24px 38px 45px 50px;
              font-size: 9px;
              text-align: right;
            }
            
            .items-head-1 div:first-child, .items-head-1 div:nth-child(2),
            .items-row-1 div:first-child, .items-row-1 div:nth-child(2) {
              text-align: left;
            }
            
            .items-head-2, .items-row-2 {
              display: grid;
              grid-template-columns: 18px 65px 120px 45px;
              font-size: 8.5px;
              color: #222;
              margin-bottom: 3px;
            }
            
            .items-head-2 div:last-child, .items-row-2 div:last-child {
              text-align: right;
            }
            
            .items-head-1, .items-head-2 {
              font-weight: bold;
            }
            
            .totals-row {
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              font-weight: bold;
              padding: 2px 0;
            }
            
            .gst-section {
              margin: 4px 0;
              font-size: 9px;
            }
            
            .gst-title {
              font-weight: bold;
              font-size: 9.5px;
              margin-bottom: 2px;
            }
            
            .gst-grid {
              display: grid;
              grid-template-columns: 65px 50px 45px 45px 40px;
              text-align: right;
              font-size: 8.5px;
              margin: 1px 0;
            }
            
            .gst-grid div:first-child {
              text-align: left;
            }
            
            .gst-header {
              font-weight: bold;
            }
            
            .calc-row {
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              margin: 1.5px 0;
            }
            
            .calc-row-bold {
              font-weight: bold;
              font-size: 11px;
            }
            
            .amount-words {
              font-size: 9px;
              font-weight: bold;
              margin: 4px 0 2px 0;
            }
            
            .receipt-footer {
              text-align: center;
              font-size: 8px;
              margin-top: 6px;
              line-height: 1.3;
            }
            
            .receipt-footer .policy {
              margin-bottom: 4px;
            }
            
            .receipt-footer .thank-you {
              font-size: 9.5px;
              font-weight: bold;
              margin: 3px 0 1px 0;
            }
            
            .receipt-footer .store-sign {
              font-size: 9px;
            }
          </style>
        </head>
        <body>
          <div id="billPaper">
            <div class="store-brand">${(shopDetails.name || 'RV FASHION').toUpperCase()}</div>
            <div class="store-subtitle">${shopDetails.subtitle || `${(shopDetails.name || 'RV FASHION').toUpperCase()} TIRUVALLUR`}</div>
            <div class="store-subtitle2">${shopDetails.subtitle2 || 'RV ENTERPRISES'}</div>
            <div class="store-address">${shopDetails.address || '#1944, TNHB H.G.ROAD, KAKKALUR BY PASS, KAKKALUR- 602003'}</div>
            <div class="store-gstin">GSTIN : ${shopDetails.gst || '33GAHPR3113J1ZP'}</div>
            <div class="store-phone">Ph:${shopDetails.phone || '8220912322 / 9843738588'}</div>
            
            <div class="divider-solid"></div>
            <div class="invoice-title">Sales Invoice</div>
            <div class="divider-solid"></div>
            
            <div class="invoice-meta-row">
              <span>Invoice No : ${billNumber}</span>
            </div>
            <div class="invoice-meta-row">
              <span>Date: ${currentDate} ${currentTime}</span>
            </div>
            <div class="divider-dashed"></div>
            
            <div class="customer-meta-row">
              <span>Name: ${customerName}</span>
              <span>PH : ${customerPhone || 'N/A'}</span>
            </div>
            <div class="divider-dashed"></div>
            
            <div class="items-table">
              <div class="items-head-1">
                <div>Sl</div>
                <div>Barcode</div>
                <div>Qty</div>
                <div>Price</div>
                <div>Disc</div>
                <div>Amount</div>
              </div>
              <div class="items-head-2">
                <div></div>
                <div>HSN</div>
                <div>Department</div>
                <div>GST%</div>
              </div>
              <div class="divider-dashed"></div>
              
              ${activeProducts.length === 0 ? `
                <div style="text-align: center; padding: 6px; font-style: italic; font-size: 9px;">--- No items in bill ---</div>
              ` : activeProducts.map((product, idx) => {
                const qty = parseInt(product.quantity) || 1;
                const price = parseFloat(product.mrp) || parseFloat(product.sellPrice) || 0;
                const itemTotal = parseFloat(product.total) || (price * qty);
                const itemGross = price * qty;
                const itemDisc = Math.max(0, itemGross - itemTotal);
                const barcodeStr = product.productCode || product.model || ('RV' + String(product.id || (idx + 1)).padStart(4, '0'));
                const hsnStr = product.hsn || '61091000';
                const deptStr = (product.category || product.type || 'TEXTILE').toUpperCase();
                
                return `
                  <div class="items-row-1">
                    <div>${idx + 1}</div>
                    <div>${barcodeStr}</div>
                    <div>${qty}</div>
                    <div>${price.toFixed(0)}</div>
                    <div>${itemDisc > 0 ? itemDisc.toFixed(2) : '0.00'}</div>
                    <div>${itemTotal.toFixed(2)}</div>
                  </div>
                  <div class="items-row-2">
                    <div></div>
                    <div>${hsnStr}</div>
                    <div>${deptStr.substring(0, 15)}</div>
                    <div>5</div>
                  </div>
                `;
              }).join('')}
              
              <div class="divider-dashed"></div>
              <div class="totals-row">
                <span>Total :</span>
                <span>${totalQuantity.toFixed(2)}</span>
                <span>${totalGrossSale.toFixed(0)}</span>
                <span>${promoDiscount.toFixed(2)}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div class="divider-dashed"></div>
            </div>
            
            <div class="gst-section">
              <div class="gst-title">GST Summary:</div>
              <div class="divider-dotted"></div>
              <div class="gst-grid gst-header">
                <div>Description</div>
                <div>Taxable</div>
                <div>CGST</div>
                <div>SGST</div>
                <div>CESS</div>
              </div>
              <div class="gst-grid">
                <div>GST 18%</div>
                <div>${taxableAmount.toFixed(2)}</div>
                <div>${cgstAmount.toFixed(2)}</div>
                <div>${sgstAmount.toFixed(2)}</div>
                <div>0.00</div>
              </div>
              <div class="divider-dotted"></div>
              <div class="gst-grid" style="font-weight: bold;">
                <div>Total:</div>
                <div>${taxableAmount.toFixed(2)}</div>
                <div>${cgstAmount.toFixed(2)}</div>
                <div>${sgstAmount.toFixed(2)}</div>
                <div>0.00</div>
              </div>
              <div class="divider-dotted"></div>
            </div>
            
            <div class="calc-row">
              <span>${paymentMethod.toUpperCase()}:</span>
              <span>${(paidAmount > 0 ? paidAmount : total).toFixed(2)}</span>
            </div>
            <div class="calc-row">
              <span>Return Amount:</span>
              <span>${change.toFixed(2)}</span>
            </div>
            <div class="divider-solid"></div>
            
            <div class="calc-row">
              <span>Total Sale:</span>
              <span>${totalGrossSale.toFixed(2)}</span>
            </div>
            <div class="calc-row">
              <span>Promo Discount:</span>
              <span>${promoDiscount.toFixed(2)}</span>
            </div>
            <div class="calc-row">
              <span>Bill Discount:</span>
              <span>${discountAmount.toFixed(2)}</span>
            </div>
            <div class="calc-row">
              <span>Total Savings:</span>
              <span>${totalSavings.toFixed(2)}</span>
            </div>
            <div class="calc-row">
              <span>Round Off:</span>
              <span>${roundOff.toFixed(2)}</span>
            </div>
            <div class="calc-row calc-row-bold">
              <span>Net Payable:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div class="amount-words">
              Rs. ${wordsTotal} Only.
            </div>
            
            <div class="divider-solid"></div>
            <div class="receipt-footer">
              <p class="policy">Returns will be accepted within 7 days only along with invoice copy, product label and saleable condition.</p>
              <p class="thank-you">Thank You. Please visit again.</p>
              <p class="store-sign">--${shopDetails.name || 'RV Fashion'}--</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Download bill as HTML file
  const downloadBill = () => {
    const subtotal = calculateSubtotal();
    if (subtotal === 0) {
      setError('No items with quantity > 0 to download!');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const billHTML = generateBillHTML();
    const blob = new Blob([billHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${billNumber.replace(/[\/\\]/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccess('Bill downloaded successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Handle payment completion - Save to DB then download/print
  const handlePaymentComplete = async () => {
    const subtotal = calculateSubtotal();
    if (subtotal === 0) {
      setError('No items with quantity > 0 in bill!');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Save to database first
    const savedData = await saveBillToDatabase();

    if (savedData) {
      // Then download the bill
      downloadBill();
    }
  };

  // Handle print - Save to DB then print
  const handlePrint = async () => {
    const subtotal = calculateSubtotal();
    if (subtotal === 0) {
      setError('No items with quantity > 0 to print!');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Save to database first
    const savedData = await saveBillToDatabase();

    if (savedData) {
      // Create a new window for printing with the exact generated bill HTML
      const printWindow = window.open('', '_blank');

      if (printWindow) {
        const fullHTML = generateBillHTML().replace(
          '</body>',
          `<script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 300);
            };
          </script></body>`
        );
        printWindow.document.write(fullHTML);
        printWindow.document.close();
      } else {
        setError('Pop-up blocked! Please allow pop-ups for this site to print.');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  // Handle WhatsApp share
  const handleWhatsAppShare = () => {
    if (!customerPhone) {
      setError('Please enter customer phone number to share via WhatsApp');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = customerPhone.replace(/\D/g, '');

    // Check if phone number is valid
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Format phone number for WhatsApp (add country code if not present)
    const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    // Create message
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxAmount = calculateTaxAmount();
    const total = calculateTotal();
    const due = calculateDue();
    const activeProducts = selectedProducts.filter(p => p.quantity > 0);

    let message = `*${shopDetails.name || 'RV Fashion'}*\n`;
    message += `${shopDetails.subtitle || 'RV FASHION TIRUVALLUR'}\n`;
    message += `${shopDetails.address || ''}\n`;
    if (shopDetails.phone) message += `Ph: ${shopDetails.phone}\n`;
    message += `Sales Invoice No: ${billNumber}\n`;
    message += `Date: ${currentDate} ${currentTime}\n`;
    message += `Customer: ${customerName}\n`;
    message += `================\n`;
    message += `ITEMS:\n`;

    activeProducts.forEach((p, idx) => {
      const price = parseFloat(p.mrp) || parseFloat(p.sellPrice) || 0;
      message += `${idx + 1}. ${p.name.substring(0, 15)} | Qty: ${p.quantity} | ₹${price.toFixed(0)} | Total: ₹${p.total.toFixed(2)}\n`;
    });

    message += `================\n`;
    message += `Subtotal: ₹${subtotal.toFixed(2)}\n`;
    if (discountAmount > 0) message += `Discount: -₹${discountAmount.toFixed(2)}\n`;
    message += `*NET PAYABLE: ₹${total.toFixed(2)}*\n`;
    message += `Payment: ${paymentMethod.toUpperCase()} | Paid: ₹${paidAmount.toFixed(2)}\n`;
    message += `================\n`;
    message += `Returns accepted within 10 days only along with invoice copy.\n`;
    message += `Thank you for shopping with ${shopDetails.name || 'RV Fashion'}!`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp with customer's number
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');

    setSuccess('WhatsApp opened with bill details!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Clear/delete draft bill
  const clearBill = (confirmUser = true) => {
    if (!confirmUser || window.confirm('Are you sure you want to delete this draft bill? All added items and quantities will be removed.')) {
      localStorage.removeItem('active_draft_bill');
      setSelectedProducts([]);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerGST('');
      setCustomerAddress('');
      setCustomerType('retail');
      setCustomerDiscount(0);
      setOrderReference('');
      setDeliveryNote('');
      setDiscount(0);
      setDiscountType('percentage');
      setManualDiscount(false);
      setTax(0);
      setTaxType('percentage');
      setPaidAmount(0);
      setCashReceived(0);
      setPaymentMethod('cash');
      setPaymentStatus('pending');
      setCardNumber('');
      setCardHolderName('');
      setUpiId('');
      setTransactionId('');
      setBankName('');
      setChequeNumber('');
      setError('');
      if (confirmUser) {
        setSuccess('Draft bill deleted');
        setTimeout(() => setSuccess(''), 2000);
      }
      setBillSaved(false);
      setShowWhatsApp(false);
      setLastGeneratedBill(null);
      setSavedBillId(null);
      generateBillNumber();
    }
  };

  // Handle new bill
  const handleNewBill = () => {
    clearBill(true);
  };

  // Handle key press for barcode
  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      getProductByBarcode();
    }
  };

  // Test API connection
  const testAPIConnection = async () => {
    try {
      const response = await api.get('/health');
      console.log('API Health:', response.data);
    } catch (err) {
      console.error('API Health Check Failed:', err);
    }
  };

  // Run API test on mount
  useEffect(() => {
    testAPIConnection();
  }, []);

  // Filter out items with quantity 0 for display in bill summary
  const activeProducts = selectedProducts.filter(p => p.quantity > 0);
  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscountAmount();
  const taxAmount = calculateTaxAmount();
  const total = calculateTotal();
  const due = calculateDue();
  const change = calculateChange();

  const totalQuantity = activeProducts.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
  const totalGrossSale = activeProducts.reduce((sum, p) => sum + ((parseFloat(p.mrp) || parseFloat(p.sellPrice) || 0) * (parseInt(p.quantity) || 0)), 0);
  const promoDiscount = Math.max(0, totalGrossSale - subtotal);
  const totalSavings = promoDiscount + discountAmount;
  const subtotalAfterDisc = Math.max(0, subtotal - discountAmount);
  const taxableAmount = subtotalAfterDisc / 1.18;
  const cgstAmount = taxableAmount * 0.09;
  const sgstAmount = taxableAmount * 0.09;
  const roundOff = 0.00;
  const wordsTotal = numberToWords(total);

  // Dynamic styles that depend on state
  const dynamicStyles = {
    changeAmount: {
      fontWeight: 'bold',
      color: paidAmount >= total ? '#34d399' : '#f87171',
      fontSize: '11px',
    },
    zeroQuantity: {
      opacity: 0.6,
      background: 'rgba(245, 158, 11, 0.15)',
      border: '1px solid rgba(245, 158, 11, 0.4)',
    }
  };

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ ...baseStyles.container, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '10px', textAlign: 'center' }}>
          <h2>🔒 Authentication Required</h2>
          <p style={{ color: '#dc3545', margin: '20px 0' }}>{error || 'Please login to access billing'}</p>
          <button
            style={{ ...baseStyles.btn, ...baseStyles.btnPrimary, padding: '10px 30px' }}
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Handle phone number input change
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 10) {
      setCustomerPhone(value);
    }
  };

  return (
    <div style={baseStyles.container}>
      {/* Left Panel - Product Selection */}
      <div style={baseStyles.productPanel} className="no-print">
        <h2 style={baseStyles.productPanelTitle}>🧾 Create New Bill</h2>

        {/* Company Selector */}
        {companies.length > 0 && (
          <div style={baseStyles.companySelector}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setShowCompanySelector(!showCompanySelector)}
            >
              <span>
                🏢 <span style={baseStyles.companyName}>
                  {selectedCompany ? selectedCompany.name : 'Select Company'}
                </span>
              </span>
              <span style={{ fontSize: '12px' }}>{showCompanySelector ? '▲' : '▼'}</span>
            </div>
            {showCompanySelector && (
              <div style={baseStyles.companyDropdown}>
                {companies.map(company => (
                  <div
                    key={company.id}
                    style={baseStyles.companyOption}
                    onClick={() => handleCompanySelect(company)}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {company.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating Toast Notification Container (Prevents page layout shifting) */}
        <div style={baseStyles.toastContainer}>
          {error && (
            <div style={{ ...baseStyles.alert, ...baseStyles.alertError }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{ ...baseStyles.alert, ...baseStyles.alertSuccess }}>
              ✅ {success}
            </div>
          )}
        </div>

        <div style={baseStyles.searchSection}>
          <div style={baseStyles.searchBox}>
            <label style={baseStyles.searchLabel}>🔍 Search Products:</label>
            <input
              type="text"
              style={baseStyles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type name, product code (SKU) or category…"
              autoComplete="off"
              onFocus={(e) => {
                e.target.style.borderColor = '#60a5fa';
                if (searchQuery.trim().length >= 1) searchProducts();
              }}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
            {searchLoading && <div style={baseStyles.searchLoading}>Searching...</div>}

            {/* Search Dropdown Floating overlay directly under input */}
            {searchQuery.trim().length >= 1 && (
              <div style={baseStyles.searchResults}>
                {searchLoading ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#60a5fa', fontSize: '13px' }}>
                    Searching products...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(product => (
                    <div
                      key={product.id}
                      style={baseStyles.searchResultItem}
                      onClick={() => addProductToBill(product)}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={baseStyles.resultInfo}>
                        <div style={baseStyles.resultName}>{product.name}</div>
                        <div style={baseStyles.resultDetails}>
                          {product.productCode ? <span style={{ fontFamily: 'monospace', color: '#fbbf24', marginRight: '6px' }}>{product.productCode}</span> : null}
                          {product.category ? <span style={{ color: '#a5b4fc', marginRight: '6px' }}>{product.category}</span> : null}
                          {product.unit ? <span style={{ color: '#6ee7b7', marginRight: '6px' }}>{product.unit}</span> : null}
                          Stock: <span style={{ color: product.quantity > 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{product.quantity}</span>
                        </div>
                      </div>
                      <div style={baseStyles.resultPrice}>₹{product.sellPrice}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No products found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={baseStyles.barcodeInput}>
            <input
              type="text"
              style={baseStyles.barcodeField}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={handleBarcodeKeyPress}
              placeholder="🏷️ Enter Product Code (SKU)…"
              onFocus={(e) => e.target.style.borderColor = '#34d399'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
            <button
              style={{
                ...baseStyles.barcodeButton,
                ...(loading ? baseStyles.barcodeButtonDisabled : {})
              }}
              onClick={getProductByBarcode}
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        <div style={baseStyles.selectedProducts}>
          <h3 style={baseStyles.selectedProductsTitle}>
            🛒 Current Bill Items ({activeProducts.length} active / {selectedProducts.length} total)
          </h3>
          <div style={baseStyles.selectedItemsList}>
            {selectedProducts.length === 0 ? (
              <p style={baseStyles.noItems}>No items added yet. Search or scan products to add.</p>
            ) : (
              selectedProducts.map(product => (
                <div
                  key={product.id}
                  style={baseStyles.selectedItem}
                >
                  <div style={baseStyles.itemInfo}>
                    <span style={baseStyles.itemName}>{product.name}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {product.productCode ? <span style={{ fontFamily: 'monospace', color: '#fbbf24', marginRight: '4px' }}>{product.productCode}</span> : null}
                      {product.category ? <span style={{ color: '#a5b4fc', marginRight: '4px' }}>{product.category}</span> : null}
                      {product.unit ? <span style={{ color: '#6ee7b7', marginRight: '4px' }}>{product.unit}</span> : null}
                      Stock: {product.maxQuantity}
                    </span>
                  </div>
                  <div style={baseStyles.itemPrice}>₹{product.sellPrice}</div>

                  {/* Clean Modern Quantity Stepper without legacy spinners or badges */}
                  <div style={baseStyles.qtyStepper}>
                    <button
                      type="button"
                      style={baseStyles.qtyBtnMinus}
                      onClick={() => {
                        if (product.quantity <= 1) {
                          removeProduct(product.id);
                        } else {
                          updateQuantity(product.id, product.quantity - 1);
                        }
                      }}
                      title={product.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                    >
                      −
                    </button>
                    <span style={baseStyles.qtyValue}>{product.quantity}</span>
                    <button
                      type="button"
                      style={{
                        ...baseStyles.qtyBtnPlus,
                        opacity: product.quantity >= product.maxQuantity ? 0.4 : 1,
                        cursor: product.quantity >= product.maxQuantity ? 'not-allowed' : 'pointer'
                      }}
                      onClick={() => updateQuantity(product.id, Math.min(product.maxQuantity, product.quantity + 1))}
                      disabled={product.quantity >= product.maxQuantity}
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div style={baseStyles.itemTotal}>₹{product.total.toFixed(2)}</div>
                  <button
                    type="button"
                    style={baseStyles.removeBtn}
                    onClick={() => removeProduct(product.id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #f43f5e, #e11d48)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'}
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          {selectedProducts.length > 0 && (
            <p style={{ fontSize: '11px', color: '#666', marginTop: '10px', textAlign: 'center' }}>
              💡 Set quantity to 0 to keep item in list (will not be billed)
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Thermal Bill */}
      <div style={baseStyles.billPanel} className="no-print">
        <div style={baseStyles.billContainer}>
          <div
            style={baseStyles.billPaper}
            id="billPaper"
            ref={billPaperRef}
          >
            {/* Store Brand Header */}
            <div style={baseStyles.receiptBrand}>
              {(shopDetails.name || 'RV FASHION').toUpperCase()}
            </div>
            <div style={baseStyles.receiptSubtitle}>
              {shopDetails.subtitle || `${(shopDetails.name || 'RV FASHION').toUpperCase()} TIRUVALLUR`}
            </div>
             <div style={baseStyles.receiptSubtitle}>
              {shopDetails.subtitle2 || `${(shopDetails.name || 'RV ENTERPRISES').toUpperCase()}`}
            </div>
            <div style={baseStyles.receiptHeaderP}>
              {shopDetails.address || '#1944, TNHB H.G.ROAD, KAKKALUR BY PASS, KAKKALUR- 602003'}
            </div>
            <div style={baseStyles.receiptHeaderP}>
              GSTIN : {shopDetails.gst || '33GAHPR3113J1ZP'}
            </div>
            <div style={baseStyles.receiptHeaderP}>
              Ph:{shopDetails.phone || '8220912322 / 9843738588'}
            </div>

            <div style={baseStyles.receiptDividerSolid}></div>
            <div style={baseStyles.receiptSalesInvoice}>Sales Invoice</div>
            <div style={baseStyles.receiptDividerSolid}></div>

            {/* Invoice Meta */}
            <div style={baseStyles.billInfoRow}>
              <span>Invoice No : {billNumber}</span>
            </div>
            <div style={baseStyles.billInfoRow}>
              <span>Date: {currentDate} {currentTime}</span>
            </div>
            <div style={baseStyles.receiptDividerDashed}></div>

            {/* Customer Meta */}
            <div style={{ ...baseStyles.customerRow, fontWeight: 'bold' }}>
              <span>Name: {customerName}</span>
              <span>PH :{customerPhone || 'N/A'}</span>
            </div>
            <div style={baseStyles.receiptDividerDashed}></div>

            {/* Editable Controls on Screen (No-Print) */}
            <div style={baseStyles.customerSection} className="no-print">
              <select
                style={baseStyles.customerTypeSelect}
                value={customerType}
                onChange={(e) => {
                  setCustomerType(e.target.value);
                  setManualDiscount(false);
                }}
              >
                <option value="retail">🛍️ Retail Customer</option>
                <option value="wholesale">🏭 Wholesale (10% off)</option>
                <option value="bulk">📦 Bulk Order (15% off)</option>
                <option value="corporate">🏢 Corporate</option>
                <option value="walk-in">🚶 Walk-in</option>
              </select>

              <input
                type="text"
                style={baseStyles.customerInput}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
              />

              <input
                type="text"
                style={{
                  ...baseStyles.customerInput,
                  borderColor: fetchingCustomer ? '#007bff' : '#ddd',
                  background: fetchingCustomer ? '#f0f7ff' : 'white'
                }}
                value={customerPhone}
                onChange={handlePhoneChange}
                placeholder={fetchingCustomer ? "Searching..." : "Phone Number"}
                maxLength="10"
              />

              <input
                type="email"
                style={baseStyles.customerInput}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email Address"
              />

              <input
                type="text"
                style={baseStyles.customerInput}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Address"
              />

              <input
                type="text"
                style={baseStyles.customerInput}
                value={customerGST}
                onChange={(e) => setCustomerGST(e.target.value)}
                placeholder="GST Number (if applicable)"
              />
            </div>

            {/* Discount Section - No-Print */}
            <div style={baseStyles.discountSection} className="no-print">
              <div
                style={baseStyles.discountHeader}
                onClick={() => setShowDiscountInput(!showDiscountInput)}
              >
                <span style={baseStyles.discountTitle}>
                  {manualDiscount ? '✏️ Manual Discount' :
                    customerType === 'wholesale' ? '🏭 Wholesale Discount (10%)' :
                    customerType === 'bulk' ? '📦 Bulk Discount (15%)' :
                    '💰 Discount'}
                </span>
                <span style={baseStyles.discountToggle}>
                  {showDiscountInput ? '▼' : '▶'}
                </span>
              </div>

              {showDiscountInput && (
                <div style={baseStyles.discountControls}>
                  <select
                    style={baseStyles.discountTypeSelect}
                    value={discountType}
                    onChange={(e) => handleDiscountTypeChange(e.target.value)}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>

                  <input
                    type="number"
                    style={baseStyles.discountInput}
                    value={discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    min="0"
                    max={discountType === 'percentage' ? 100 : subtotal}
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter amount'}
                  />
                </div>
              )}

              <div style={baseStyles.discountAmount}>
                Discount Amount: -₹{discountAmount.toFixed(2)}
              </div>

              {manualDiscount && (
                <button
                  style={{
                    ...baseStyles.btn,
                    ...baseStyles.btnSecondary,
                    fontSize: '9px',
                    padding: '2px 5px',
                    marginTop: '5px',
                    width: '100%'
                  }}
                  onClick={resetDiscountToDefault}
                >
                  Reset to Default
                </button>
              )}
            </div>

            {/* Items Table */}
            <div style={{ width: '100%', margin: '4px 0' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '18px 75px 24px 38px 45px 50px',
                fontSize: '9px',
                fontWeight: 'bold',
                textAlign: 'right'
              }}>
                <div style={{ textAlign: 'left' }}>Sl</div>
                <div style={{ textAlign: 'left' }}>Barcode</div>
                <div>Qty</div>
                <div>Price</div>
                <div>Disc</div>
                <div>Amount</div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '18px 65px 120px 45px',
                fontSize: '8.5px',
                fontWeight: 'bold',
                color: '#222'
              }}>
                <div></div>
                <div style={{ textAlign: 'left' }}>HSN</div>
                <div style={{ textAlign: 'left' }}>Department</div>
                <div style={{ textAlign: 'right' }}>GST%</div>
              </div>

              <div style={baseStyles.receiptDividerDashed}></div>

              <div>
                {activeProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: '6px', fontStyle: 'italic', fontSize: '9px' }}>
                    --- No items in bill ---
                  </div>
                ) : (
                  activeProducts.map((product, idx) => {
                    const qty = parseInt(product.quantity) || 1;
                    const price = parseFloat(product.mrp) || parseFloat(product.sellPrice) || 0;
                    const itemTotal = parseFloat(product.total) || (price * qty);
                    const itemGross = price * qty;
                    const itemDisc = Math.max(0, itemGross - itemTotal);
                    const barcodeStr = product.productCode || product.model || ('RV' + String(product.id || (idx + 1)).padStart(4, '0'));
                    const hsnStr = product.hsn || '61091000';
                    const deptStr = (product.category || product.type || 'TEXTILE').toUpperCase();

                    return (
                      <div key={product.id || idx} style={{ marginBottom: '2px' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '18px 75px 24px 38px 45px 50px',
                          fontSize: '9px',
                          textAlign: 'right'
                        }}>
                          <div style={{ textAlign: 'left' }}>{idx + 1}</div>
                          <div style={{ textAlign: 'left' }}>{barcodeStr}</div>
                          <div>{qty}</div>
                          <div>{price.toFixed(0)}</div>
                          <div>{itemDisc > 0 ? itemDisc.toFixed(2) : '0.00'}</div>
                          <div>{itemTotal.toFixed(2)}</div>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '18px 65px 120px 45px',
                          fontSize: '8.5px',
                          color: '#333'
                        }}>
                          <div></div>
                          <div style={{ textAlign: 'left' }}>{hsnStr}</div>
                          <div style={{ textAlign: 'left' }}>{deptStr.substring(0, 15)}</div>
                          <div style={{ textAlign: 'right' }}>5</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={baseStyles.receiptDividerDashed}></div>

              {/* Totals Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '9.5px',
                fontWeight: 'bold',
                padding: '2px 0'
              }}>
                <span>Total :</span>
                <span>{totalQuantity.toFixed(2)}</span>
                <span>{totalGrossSale.toFixed(0)}</span>
                <span>{promoDiscount.toFixed(2)}</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              <div style={baseStyles.receiptDividerDashed}></div>
            </div>

            {/* GST Summary */}
            <div style={{ margin: '4px 0', fontSize: '9px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '9.5px', marginBottom: '2px' }}>GST Summary:</div>
              <div style={baseStyles.receiptDividerDotted}></div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '65px 50px 45px 45px 40px',
                textAlign: 'right',
                fontSize: '8.5px',
                fontWeight: 'bold'
              }}>
                <div style={{ textAlign: 'left' }}>Description</div>
                <div>Taxable</div>
                <div>CGST</div>
                <div>SGST</div>
                <div>CESS</div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '65px 50px 45px 45px 40px',
                textAlign: 'right',
                fontSize: '8.5px',
                margin: '1px 0'
              }}>
                <div style={{ textAlign: 'left' }}>GST 18%</div>
                <div>{taxableAmount.toFixed(2)}</div>
                <div>{cgstAmount.toFixed(2)}</div>
                <div>{sgstAmount.toFixed(2)}</div>
                <div>0.00</div>
              </div>
              <div style={baseStyles.receiptDividerDotted}></div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '65px 50px 45px 45px 40px',
                textAlign: 'right',
                fontSize: '8.5px',
                fontWeight: 'bold'
              }}>
                <div style={{ textAlign: 'left' }}>Total:</div>
                <div>{taxableAmount.toFixed(2)}</div>
                <div>{cgstAmount.toFixed(2)}</div>
                <div>{sgstAmount.toFixed(2)}</div>
                <div>0.00</div>
              </div>
              <div style={baseStyles.receiptDividerDotted}></div>
            </div>

            {/* Payment & Totals Breakdown */}
            <div style={{ margin: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>{paymentMethod.toUpperCase()}:</span>
                <span>{(paidAmount > 0 ? paidAmount : total).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Return Amount:</span>
                <span>{change.toFixed(2)}</span>
              </div>
              <div style={baseStyles.receiptDividerSolid}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Total Sale:</span>
                <span>{totalGrossSale.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Promo Discount:</span>
                <span>{promoDiscount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Bill Discount:</span>
                <span>{discountAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Total Savings:</span>
                <span>{totalSavings.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', margin: '1.5px 0' }}>
                <span>Round Off:</span>
                <span>{roundOff.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 'bold',
                margin: '2px 0'
              }}>
                <span>Net Payable:</span>
                <span>{total.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '9px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>
                Rs. {wordsTotal} Only.
              </div>
            </div>

            {/* Payment Interactive Section (No-Print) */}
            <div style={baseStyles.paymentSection} className="no-print">
              <div style={baseStyles.paymentRow}>
                <span>Payment Method:</span>
                <select
                  style={baseStyles.paymentSelect}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="upi">📱 UPI</option>
                  <option value="cheque">📝 Cheque</option>
                  <option value="mixed">🔄 Mixed</option>
                </select>
              </div>

              {showPaymentDetails && (
                <div style={baseStyles.paymentDetails}>
                  {paymentMethod === 'cash' && (
                    <>
                      <div style={baseStyles.paymentRow}>
                        <span>Cash Received:</span>
                        <input
                          type="number"
                          style={baseStyles.paymentInput}
                          value={cashReceived}
                          onChange={(e) => handleCashPayment(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div style={baseStyles.paymentRow}>
                        <span>Change:</span>
                        <span style={dynamicStyles.changeAmount}>₹{change.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {paymentMethod === 'card' && (
                    <>
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="Card Number (last 4 digits)"
                        maxLength="4"
                      />
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value)}
                        placeholder="Card Holder Name"
                      />
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Transaction ID"
                      />
                    </>
                  )}

                  {paymentMethod === 'upi' && (
                    <>
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="UPI ID"
                      />
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Transaction ID"
                      />
                    </>
                  )}

                  {paymentMethod === 'cheque' && (
                    <>
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="Cheque Number"
                      />
                      <input
                        type="text"
                        style={baseStyles.paymentDetailsInput}
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Bank Name"
                      />
                    </>
                  )}

                  {paymentMethod === 'mixed' && (
                    <div style={{ fontSize: '9px', color: '#666' }}>
                      <p>Mixed payment - Please enter details in POS</p>
                    </div>
                  )}
                </div>
              )}

              <div style={baseStyles.paymentRow}>
                <span>Paid Amount:</span>
                <input
                  type="number"
                  style={baseStyles.paymentInput}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>

              <div style={baseStyles.paymentRow}>
                <span>Payment Status:</span>
                <span style={{
                  color: paymentStatus === 'paid' ? '#28a745' :
                    paymentStatus === 'partial' ? '#ffc107' : '#dc3545',
                  fontWeight: 'bold'
                }}>
                  {paymentStatus.toUpperCase()}
                </span>
              </div>

              {due > 0 && paymentStatus !== 'pending' && (
                <div style={baseStyles.paymentRow}>
                  <span>Due Amount:</span>
                  <span>₹{due.toFixed(2)}</span>
                </div>
              )}

              <button
                style={{
                  ...baseStyles.btn,
                  ...baseStyles.btnSecondary,
                  width: '100%',
                  marginTop: '5px',
                  padding: '5px'
                }}
                onClick={handleExactPayment}
              >
                Exact Amount
              </button>
            </div>

            {/* Receipt Footer */}
            <div style={baseStyles.receiptDividerSolid}></div>
            <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '6px', lineHeight: '1.3' }}>
              <p style={{ marginBottom: '4px' }}>
                Returns will be accepted within 7 days only along with invoice copy, product label and saleable condition.
              </p>
              <p style={{ fontSize: '9.5px', fontWeight: 'bold', margin: '3px 0 1px 0' }}>
                Thank You. Please visit again.
              </p>
              <p style={{ fontSize: '9px' }}>--{shopDetails.name || 'RV Fashion'}--</p>
            </div>
          </div>

          <div style={baseStyles.actionButtons} className="no-print">
            <button
              style={{
                ...baseStyles.btn,
                ...baseStyles.btnPrimary,
                ...(loading || activeProducts.length === 0 ? baseStyles.btnDisabled : {})
              }}
              onClick={handlePrint}
              disabled={loading || activeProducts.length === 0}
            >
              {loading ? '⏳ Saving...' : '🖨️ Print'}
            </button>
            <button
              style={{
                ...baseStyles.btn,
                ...baseStyles.btnSuccess,
                ...(loading || activeProducts.length === 0 ? baseStyles.btnDisabled : {})
              }}
              onClick={handlePaymentComplete}
              disabled={loading || activeProducts.length === 0}
            >
              {loading ? '⏳ Saving...' : '💰 Pay & Download'}
            </button>
            <button
              style={{
                ...baseStyles.btn,
                ...baseStyles.btnInfo,
                ...(loading ? baseStyles.btnDisabled : {})
              }}
              onClick={handleNewBill}
              disabled={loading}
              title="Start a fresh bill"
            >
              🆕 New Bill
            </button>
            <button
              style={{
                ...baseStyles.btn,
                ...baseStyles.btnDanger,
                ...(loading ? baseStyles.btnDisabled : {})
              }}
              onClick={() => clearBill(true)}
              disabled={loading}
              title="Delete current draft bill"
            >
              🗑️ Delete Draft Bill
            </button>
          </div>

          {/* WhatsApp Share Button - Always visible when bill is saved */}
          {showWhatsApp && lastGeneratedBill && (
            <button
              style={baseStyles.whatsappButton}
              onClick={handleWhatsAppShare}
              onMouseEnter={(e) => e.currentTarget.style.background = '#128C7E'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#25D366'}
            >
              <span>📱</span>
              Share Bill on WhatsApp to {customerPhone || 'Customer'}
            </button>
          )}

          {billSaved && (
            <p style={{ fontSize: '10px', color: '#28a745', textAlign: 'center', marginTop: '5px' }}>
              ✓ Bill saved to database
            </p>
          )}
        </div>
      </div>

      {/* Hidden download link */}
      <a ref={downloadLinkRef} style={baseStyles.downloadLink}></a>
    </div>
  );
};

export default Bill;