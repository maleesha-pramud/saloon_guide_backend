export interface UserRole {
  id?: number;
  name: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export const userRoleTableQuery = `
CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`;

// Query to add default roles if they don't exist
export const insertDefaultRolesQuery = `
INSERT IGNORE INTO user_roles (name, id)
VALUES 
('admin', 1),
('owner', 2),
('guest', 3)
`;
