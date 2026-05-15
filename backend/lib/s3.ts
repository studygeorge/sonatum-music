// Mock file upload utility
export const uploadFile = async (file: File): Promise<string> => {
  return `/uploads/mock-${Date.now()}-${file.name}`;
};
