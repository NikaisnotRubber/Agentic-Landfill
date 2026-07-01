export type ProcessedDdpRow = {
  ticketId: string;
  status: string;
  subject: string;
  requester: string;
  isNewTicket: boolean;
  adAccount: string;
  adName: string;
  firstName: string;
  lastName: string;
  mail: string;
  bu: string;
  nbHostname: string;
  vmHostname: string;
  role: string;
  application: string;
  userRoles: string;
  abnormalFlags: string[];
};

export type ProcessedDdpSummary = {
  totalRows: number;
  abnormalRowCount: number;
  newTicketCount: number;
  mappingSync?: {
    attempted: number;
    upserted: number;
    skipped: number;
  };
  trackerWarning?: string;
  latestSeenId?: string;
  previousSeenId?: string;
};
