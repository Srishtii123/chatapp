export type MenuNode = {
  id?: string;
  title: string;
  type: "collapse" | "group" | "item";
  icon?: string;
  serial_no?: string | number;
  serial_number?: string | number;
  SERIAL_NO?: string | number;
  url_path?: string;
  component_name?: string;
  componentName?: string;
  position?: number;
  children?: MenuNode[];
};

export type UserProfile = {
  username?: string;
  USERNAME?: string;
  email_id?: string;
  EMAIL_ID?: string;
  loginid?: string;
  LOGINID?: string;
  loginid1?: string;
  LOGINID1?: string;
  company_code?: string;
  COMPANY_CODE?: string;
  company_name?: string;
  COMPANY_NAME?: string;
  support_role?: "ADMIN" | "USER";
};

export type LoginResponse = {
  success: boolean;
  data: {
    token: string;
    user: UserProfile;
  };
  message?: string;
};

export type AuthMeResponse = {
  success: boolean;
  data: {
    user: UserProfile;
    permissionBasedMenuTree: MenuNode[];
    permissions: Record<string, unknown>;
    user_permission: Record<string, unknown>;
    userAccessibleModules?: Record<string, Record<string, boolean>>;
  };
  message?: string;
};
