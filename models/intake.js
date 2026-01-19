const mongoose = require("mongoose");

const IntakeSchema = new mongoose.Schema({
  // BASIC CLIENT INFO
  taxpayerFirstName: String,
  taxpayerLastName: String,
  addressStreet1: String,
  addressStreet2: String,
  addressCity: String,
  addressState: String,
  addressZip: String,
  phone: String,
  email: { type: String, required: true },
  dob: String,
  ssn: String,
  taxYear: String,

  // YES / NO QUESTIONS
  w2Received: String,
  unemployment: String,
  ssOrRetirement: String,
  earlyRetirementWithdrawal: String,
  paidHalfExpenses: String,
  healthInsuranceAllYear: String,
  filingStatus: String,
  healthForms: [String],
  maritalStatus: String,

  // SPOUSE INFO
  spouseFirstName: String,
  spouseLastName: String,
  spouseDob: String,
  spouseSsn: String,
  spousePhone: String,
  spouseEmail: String,
  spouseW2: String,
  ownHome: String,
  firstTimeHomeBuyer: String,
  claimDependents: String,
  eitcDenied: String,

  // DEPENDENTS
  dependents: [
    {
      firstName: String,
      lastName: String,
      relationship: String,
      dob: String,
      ssn: String
    }
  ],

  dependentsClaimedElsewhere: String,
  whichDependentClaimedElsewhere: String,
  daycareExpenses: String,
  daycareDependent: String,
  ctcAdvance: String,
  ctcAdvanceAmount: String,

  // BUSINESS / EDUCATION
  received1099: String,
  businessExpenses: String,
  collegeAttendance: String,
  whoAttendedCollege: String,
  received1098T: String,

  // STIMULUS
  stimulusRounds: [String],

  // DEBTS
  owes: [String],

  // PAYMENT / REFUND
  payForServices: String,
  refundMethod: String,
  cashAdvance: String,

  // BANK INFO
  bankName: String,
  bankAccountType: String,
  bankRoutingNumber: String,
  bankAccountNumber: String,

  // CONSENT
  textConsent: String,
  cellCarrier: String,
  howHeard: String,
  referralName: String,

  // AGREEMENT
  nonPaymentAgreement: String,
  typedFullName: String,
  signature: String,

  // FILE UPLOADS
  driversLicense: [String],
  ssCards: [String],
  birthCertificates: [String],
  proofOfResidence: [String],
  incomeForms: [String],
  form1098T: [String],
  childcareStatement: [String],

  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Intake", IntakeSchema);
