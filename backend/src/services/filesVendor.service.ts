export class FilesVendorService {
  static async getInstance(): Promise<FilesVendorService> {
    return new FilesVendorService();
  }

  async findAll(conditions: any): Promise<any[]> {
    return [];
  }

  async findOne(conditions: any): Promise<any | null> {
    return null;
  }

  async update(where: any, data: any): Promise<{ affected: number }> {
    return { affected: 0 };
  }

  async delete(where: any): Promise<{ affected: number }> {
    return { affected: 0 };
  }
}

export default FilesVendorService;
