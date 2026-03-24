import { Injectable, HttpException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class RingoverService {
    
    private ringover: AxiosInstance;

    constructor() {
        this.ringover = axios.create({
        baseURL: process.env.RINGOVER_URL,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.API_KEY_RINGOVER
        }
        });
    }

    async getEmpowerCallByID(call_id: string) {
        try {

            const call = await this.ringover.get(`/calls/${call_id}`);

            if (call.data.list) {

                const channel_id = call.data.list[0].channel_id;

                const empower = await this.ringover.get(`/empower/platform/ringover/channel/${channel_id}`);
                const call_uuid = empower.data;

                const empower_call = await this.ringover.get(`/empower/call/${call_uuid}`);

                return empower_call.data;

            } else {
                throw new Error("API get call id ne répond pas");
            }

        } catch (error) {
            throw new HttpException(
                error.response?.data || error.message,
                error.response?.status || 500
            );
        }
    }

    async getEmpowerByChannelID(channel_id: string){
        try {

            const empower = await this.ringover.get(`/empower/platform/ringover/channel/${channel_id}`);
            const call_uuid = empower.data;

            const empower_call = await this.ringover.get(`/empower/call/${call_uuid}`);

            return empower_call.data;

        } catch (error) {
            throw new HttpException(
                error.response?.data || error.message,
                error.response?.status || 500
            );
        }
    }

}
