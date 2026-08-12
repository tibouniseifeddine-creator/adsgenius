import { Campaign, CampaignMetrics } from '../types';

export class MetaService {
  static async connect(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'MOCK: Meta connected in simulation mode' };
  }
  static async getCampaigns(): Promise<Campaign[]> { return []; }
  static async createCampaign(campaign: Partial<Campaign>): Promise<{ id: string }> {
    return { id: `mock-camp-${Date.now()}` };
  }
  static async getInsights(campaignId: string): Promise<CampaignMetrics[]> { return []; }
  static async updateBudget(campaignId: string, budget: number): Promise<boolean> { return true; }
  static async pauseCampaign(campaignId: string): Promise<boolean> { return true; }
}
