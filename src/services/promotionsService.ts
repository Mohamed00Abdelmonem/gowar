import { apiRequest, IS_BACKEND_API_ENABLED } from './apiClient';
import type { AdminPromotion, Promotion, PromotionAnalyticsSummary } from '../types';
import {
  mapAdminPromotion,
  mapPublicPromotion,
  type BackendAdminPromotionPayload,
  type BackendPublicPromotionPayload,
} from './promotionsHelpers';

export {
  ALLOWED_BANNER_MIME_TYPES,
  MAX_BANNER_FILE_BYTES,
  mapAdminPromotion,
  mapPublicPromotion,
  resolvePromotionDestination,
  validateBannerImageFile,
  validatePromotionDraft,
} from './promotionsHelpers';
export type {
  BackendAdminPromotionPayload,
  BackendPublicPromotionPayload,
  PromotionDraftValidationInput,
} from './promotionsHelpers';

export const promotionsApi = {
  async fetchPublicPromotions(params?: {
    latitude?: number;
    longitude?: number;
    areaId?: string;
  }): Promise<Promotion[]> {
    if (!IS_BACKEND_API_ENABLED) return [];
    const qs = new URLSearchParams();
    if (
      params?.latitude !== undefined &&
      params?.longitude !== undefined &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude)
    ) {
      qs.set('latitude', String(params.latitude));
      qs.set('longitude', String(params.longitude));
    }
    if (params?.areaId) {
      qs.set('area_id', params.areaId);
    }
    const query = qs.toString();
    const list = await apiRequest<BackendPublicPromotionPayload[]>(
      `/promotions/${query ? `?${query}` : ''}`,
      { skipAuth: true }
    );
    return Array.isArray(list) ? list.map(mapPublicPromotion) : [];
  },

  trackView(promotionId: string): Promise<{ tracked: boolean; counted: boolean }> {
    if (!IS_BACKEND_API_ENABLED) return Promise.resolve({ tracked: false, counted: false });
    return apiRequest(`/promotions/${promotionId}/track-view/`, {
      method: 'POST',
      skipAuth: true,
    });
  },

  trackClick(promotionId: string): Promise<{ tracked: boolean; counted: boolean }> {
    if (!IS_BACKEND_API_ENABLED) return Promise.resolve({ tracked: false, counted: false });
    return apiRequest(`/promotions/${promotionId}/track-click/`, {
      method: 'POST',
      skipAuth: true,
    });
  },

  async fetchAdminPromotions(): Promise<AdminPromotion[]> {
    const res = await apiRequest<
      BackendAdminPromotionPayload[] | { results: BackendAdminPromotionPayload[] }
    >('/admin/promotions/?page_size=100');
    const items = Array.isArray(res) ? res : res.results ?? [];
    return items.map(mapAdminPromotion);
  },

  async fetchAdminAnalytics(): Promise<PromotionAnalyticsSummary> {
    const res = await apiRequest<{
      total_promotions: number;
      active_live_count: number;
      scheduled_count: number;
      expired_count: number;
      total_impressions: number;
      total_clicks: number;
      overall_ctr: number;
    }>('/admin/promotions/analytics/');
    return {
      totalPromotions: res.total_promotions,
      activeLiveCount: res.active_live_count,
      scheduledCount: res.scheduled_count,
      expiredCount: res.expired_count,
      totalImpressions: res.total_impressions,
      totalClicks: res.total_clicks,
      overallCtr: res.overall_ctr,
    };
  },

  async createAdminPromotion(formData: FormData): Promise<AdminPromotion> {
    const res = await apiRequest<BackendAdminPromotionPayload>('/admin/promotions/', {
      method: 'POST',
      body: formData,
    });
    return mapAdminPromotion(res);
  },

  async updateAdminPromotion(id: string, formData: FormData): Promise<AdminPromotion> {
    const res = await apiRequest<BackendAdminPromotionPayload>(`/admin/promotions/${id}/`, {
      method: 'PATCH',
      body: formData,
    });
    return mapAdminPromotion(res);
  },

  async toggleAdminPromotionActive(id: string): Promise<AdminPromotion> {
    const res = await apiRequest<BackendAdminPromotionPayload>(
      `/admin/promotions/${id}/toggle-active/`,
      { method: 'POST' }
    );
    return mapAdminPromotion(res);
  },

  archiveAdminPromotion(id: string): Promise<void> {
    return apiRequest(`/admin/promotions/${id}/`, { method: 'DELETE' });
  },

  reorderAdminPromotions(items: Array<{ id: string; display_order: number }>): Promise<void> {
    return apiRequest('/admin/promotions/reorder/', {
      method: 'POST',
      body: { items },
    });
  },
};
