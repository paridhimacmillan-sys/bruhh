import { createContext, useContext, ReactNode } from "react";

interface AdminContextType {
  isAdminEnabled: boolean;
}

const AdminContext = createContext<AdminContextType>({ isAdminEnabled: true });

export function AdminProvider({ children }: { children: ReactNode }) {
  return <AdminContext.Provider value={{ isAdminEnabled: true }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
