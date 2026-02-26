import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LmsConnection, LmsProvider, ConnectionStatus } from '../entities/lms-connection.entity';
import { IntegrationLog, LogLevel, LogCategory } from '../entities/integration-log.entity';
import { WebhookService } from './webhook.service';
import { DataMappingService } from './data-mapping.service';
import { ApiGatewayService } from './api-gateway.service';

export interface LmsUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  enrollments?: LmsEnrollment[];
}

export interface LmsCourse {
  id: string;
  name: string;
  description?: string;
  code?: string;
  startDate?: Date;
  endDate?: Date;
  status: string;
  enrollments?: LmsEnrollment[];
}

export interface LmsEnrollment {
  id: string;
  userId: string;
  courseId: string;
  role: string;
  status: string;
  enrolledAt: Date;
  completedAt?: Date;
  grade?: number;
}

export interface LmsAssignment {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  dueDate?: Date;
  pointsPossible?: number;
  submissions?: LmsSubmission[];
}

export interface LmsSubmission {
  id: string;
  assignmentId: string;
  userId: string;
  submittedAt: Date;
  score?: number;
  status: string;
  attachments?: string[];
}

@Injectable()
export class LmsIntegrationService {
  private readonly logger = new Logger(LmsIntegrationService.name);

  constructor(
    @InjectRepository(LmsConnection)
    private readonly lmsConnectionRepository: Repository<LmsConnection>,
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
    private readonly webhookService: WebhookService,
    private readonly dataMappingService: DataMappingService,
    private readonly apiGatewayService: ApiGatewayService,
  ) {}

  async createConnection(connectionData: Partial<LmsConnection>): Promise<LmsConnection> {
    this.logger.log(`Creating LMS connection for provider: ${connectionData.provider}`);

    const connection = this.lmsConnectionRepository.create(connectionData);
    const savedConnection = await this.lmsConnectionRepository.save(connection);

    // Test the connection
    await this.testConnection(savedConnection.id);

    return savedConnection;
  }

  async testConnection(connectionId: string): Promise<{ success: boolean; message: string; details?: any }> {
    this.logger.log(`Testing LMS connection: ${connectionId}`);

    const connection = await this.lmsConnectionRepository.findOne({ where: { id: connectionId } });
    
    if (!connection) {
      throw new Error(`LMS connection not found: ${connectionId}`);
    }

    try {
      connection.status = ConnectionStatus.AUTHENTICATING;
      await this.lmsConnectionRepository.save(connection);

      let testResult: { success: boolean; message: string; details?: any };

      switch (connection.provider) {
        case LmsProvider.CANVAS:
          testResult = await this.testCanvasConnection(connection);
          break;
        case LmsProvider.MOODLE:
          testResult = await this.testMoodleConnection(connection);
          break;
        case LmsProvider.BLACKBOARD:
          testResult = await this.testBlackboardConnection(connection);
          break;
        default:
          testResult = { success: false, message: `Unsupported LMS provider: ${connection.provider}` };
      }

      connection.status = testResult.success ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR;
      connection.lastError = testResult.success ? null : testResult.message;
      connection.syncFailureCount = testResult.success ? 0 : connection.syncFailureCount + 1;

      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        testResult.success ? LogLevel.INFO : LogLevel.ERROR,
        LogCategory.AUTHENTICATION,
        `Connection test ${testResult.success ? 'passed' : 'failed'}: ${testResult.message}`,
        { success: testResult.success, details: testResult.details }
      );

      return testResult;

    } catch (error) {
      connection.status = ConnectionStatus.ERROR;
      connection.lastError = error.message;
      connection.syncFailureCount++;
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.ERROR,
        LogCategory.AUTHENTICATION,
        `Connection test failed: ${error.message}`,
        { error: error.message }
      );

      return { success: false, message: error.message };
    }
  }

  async syncUsers(connectionId: string): Promise<{ success: boolean; usersSynced: number; errors?: string[] }> {
    this.logger.log(`Syncing users for LMS connection: ${connectionId}`);

    const connection = await this.getValidConnection(connectionId);
    const errors: string[] = [];
    let usersSynced = 0;

    try {
      let users: LmsUser[];

      switch (connection.provider) {
        case LmsProvider.CANVAS:
          users = await this.getCanvasUsers(connection);
          break;
        case LmsProvider.MOODLE:
          users = await this.getMoodleUsers(connection);
          break;
        case LmsProvider.BLACKBOARD:
          users = await this.getBlackboardUsers(connection);
          break;
        default:
          throw new Error(`Unsupported LMS provider: ${connection.provider}`);
      }

      // Transform and process each user
      for (const user of users) {
        try {
          const transformedUser = await this.dataMappingService.transformData(
            connection.id,
            user,
            this.getUserSchema()
          );

          // Send webhook for user sync
          await this.webhookService.createWebhookEvent(
            connection.id,
            'USER_CREATED' as any,
            transformedUser,
            connection.configuration?.webhookEndpoint || '',
            connection.provider
          );

          usersSynced++;
        } catch (error) {
          errors.push(`Failed to sync user ${user.id}: ${error.message}`);
        }
      }

      // Update sync timestamps
      connection.lastSyncAt = new Date();
      connection.nextSyncAt = new Date(Date.now() + connection.syncInterval * 60 * 1000);
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.INFO,
        LogCategory.DATA_SYNC,
        `User sync completed: ${usersSynced} users synced, ${errors.length} errors`,
        { usersSynced, errors }
      );

      return { success: true, usersSynced, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      connection.syncFailureCount++;
      connection.lastError = error.message;
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.ERROR,
        LogCategory.DATA_SYNC,
        `User sync failed: ${error.message}`,
        { error: error.message }
      );

      return { success: false, usersSynced: 0, errors: [error.message] };
    }
  }

  async syncCourses(connectionId: string): Promise<{ success: boolean; coursesSynced: number; errors?: string[] }> {
    this.logger.log(`Syncing courses for LMS connection: ${connectionId}`);

    const connection = await this.getValidConnection(connectionId);
    const errors: string[] = [];
    let coursesSynced = 0;

    try {
      let courses: LmsCourse[];

      switch (connection.provider) {
        case LmsProvider.CANVAS:
          courses = await this.getCanvasCourses(connection);
          break;
        case LmsProvider.MOODLE:
          courses = await this.getMoodleCourses(connection);
          break;
        case LmsProvider.BLACKBOARD:
          courses = await this.getBlackboardCourses(connection);
          break;
        default:
          throw new Error(`Unsupported LMS provider: ${connection.provider}`);
      }

      // Transform and process each course
      for (const course of courses) {
        try {
          const transformedCourse = await this.dataMappingService.transformData(
            connection.id,
            course,
            this.getCourseSchema()
          );

          // Send webhook for course sync
          await this.webhookService.createWebhookEvent(
            connection.id,
            'COURSE_ENROLLED' as any,
            transformedCourse,
            connection.configuration?.webhookEndpoint || '',
            connection.provider
          );

          coursesSynced++;
        } catch (error) {
          errors.push(`Failed to sync course ${course.id}: ${error.message}`);
        }
      }

      // Update sync timestamps
      connection.lastSyncAt = new Date();
      connection.nextSyncAt = new Date(Date.now() + connection.syncInterval * 60 * 1000);
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.INFO,
        LogCategory.DATA_SYNC,
        `Course sync completed: ${coursesSynced} courses synced, ${errors.length} errors`,
        { coursesSynced, errors }
      );

      return { success: true, coursesSynced, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      connection.syncFailureCount++;
      connection.lastError = error.message;
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.ERROR,
        LogCategory.DATA_SYNC,
        `Course sync failed: ${error.message}`,
        { error: error.message }
      );

      return { success: false, coursesSynced: 0, errors: [error.message] };
    }
  }

  async syncEnrollments(connectionId: string): Promise<{ success: boolean; enrollmentsSynced: number; errors?: string[] }> {
    this.logger.log(`Syncing enrollments for LMS connection: ${connectionId}`);

    const connection = await this.getValidConnection(connectionId);
    const errors: string[] = [];
    let enrollmentsSynced = 0;

    try {
      let enrollments: LmsEnrollment[];

      switch (connection.provider) {
        case LmsProvider.CANVAS:
          enrollments = await this.getCanvasEnrollments(connection);
          break;
        case LmsProvider.MOODLE:
          enrollments = await this.getMoodleEnrollments(connection);
          break;
        case LmsProvider.BLACKBOARD:
          enrollments = await this.getBlackboardEnrollments(connection);
          break;
        default:
          throw new Error(`Unsupported LMS provider: ${connection.provider}`);
      }

      // Transform and process each enrollment
      for (const enrollment of enrollments) {
        try {
          const transformedEnrollment = await this.dataMappingService.transformData(
            connection.id,
            enrollment,
            this.getEnrollmentSchema()
          );

          // Send webhook for enrollment sync
          await this.webhookService.createWebhookEvent(
            connection.id,
            'COURSE_ENROLLED' as any,
            transformedEnrollment,
            connection.configuration?.webhookEndpoint || '',
            connection.provider
          );

          enrollmentsSynced++;
        } catch (error) {
          errors.push(`Failed to sync enrollment ${enrollment.id}: ${error.message}`);
        }
      }

      // Update sync timestamps
      connection.lastSyncAt = new Date();
      connection.nextSyncAt = new Date(Date.now() + connection.syncInterval * 60 * 1000);
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.INFO,
        LogCategory.DATA_SYNC,
        `Enrollment sync completed: ${enrollmentsSynced} enrollments synced, ${errors.length} errors`,
        { enrollmentsSynced, errors }
      );

      return { success: true, enrollmentsSynced, errors: errors.length > 0 ? errors : undefined };

    } catch (error) {
      connection.syncFailureCount++;
      connection.lastError = error.message;
      await this.lmsConnectionRepository.save(connection);

      await this.logLmsEvent(
        connectionId,
        LogLevel.ERROR,
        LogCategory.DATA_SYNC,
        `Enrollment sync failed: ${error.message}`,
        { error: error.message }
      );

      return { success: false, enrollmentsSynced: 0, errors: [error.message] };
    }
  }

  async getConnections(filters?: {
    provider?: LmsProvider;
    status?: ConnectionStatus;
    page?: number;
    limit?: number;
  }): Promise<{ connections: LmsConnection[]; total: number }> {
    const { provider, status, page = 1, limit = 10 } = filters || {};

    const where: any = {};
    if (provider) where.provider = provider;
    if (status) where.status = status;

    const [connections, total] = await this.lmsConnectionRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { connections, total };
  }

  async getConnection(connectionId: string): Promise<LmsConnection> {
    const connection = await this.lmsConnectionRepository.findOne({ where: { id: connectionId } });
    
    if (!connection) {
      throw new Error(`LMS connection not found: ${connectionId}`);
    }

    return connection;
  }

  async updateConnection(connectionId: string, updates: Partial<LmsConnection>): Promise<LmsConnection> {
    const connection = await this.getConnection(connectionId);
    
    Object.assign(connection, updates);
    return await this.lmsConnectionRepository.save(connection);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const result = await this.lmsConnectionRepository.delete(connectionId);
    
    if (result.affected === 0) {
      throw new Error(`LMS connection not found: ${connectionId}`);
    }

    await this.logLmsEvent(
      connectionId,
      LogLevel.INFO,
      LogCategory.API_CALL,
      `LMS connection deleted`,
      { connectionId }
    );
  }

  // Canvas-specific methods
  private async testCanvasConnection(connection: LmsConnection): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.apiGatewayService.makeApiCall(
        { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { apiKey: connection.apiKey } } as any,
        'users/self',
        'GET'
      );

      if (response.success) {
        return {
          success: true,
          message: 'Canvas connection successful',
          details: response.data,
        };
      } else {
        return {
          success: false,
          message: `Canvas connection failed: ${response.error}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Canvas connection error: ${error.message}`,
      };
    }
  }

  private async getCanvasUsers(connection: LmsConnection): Promise<LmsUser[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { apiKey: connection.apiKey } } as any,
      'users',
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Canvas users: ${response.error}`);
    }

    return response.data.map(this.transformCanvasUser);
  }

  private async getCanvasCourses(connection: LmsConnection): Promise<LmsCourse[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { apiKey: connection.apiKey } } as any,
      'courses',
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Canvas courses: ${response.error}`);
    }

    return response.data.map(this.transformCanvasCourse);
  }

  private async getCanvasEnrollments(connection: LmsConnection): Promise<LmsEnrollment[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { apiKey: connection.apiKey } } as any,
      'enrollments',
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Canvas enrollments: ${response.error}`);
    }

    return response.data.map(this.transformCanvasEnrollment);
  }

  // Moodle-specific methods
  private async testMoodleConnection(connection: LmsConnection): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.apiGatewayService.makeApiCall(
        { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { token: connection.accessToken } } as any,
        'webservice/rest/server.php?wstoken=' + connection.accessToken + '&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json',
        'GET'
      );

      if (response.success) {
        return {
          success: true,
          message: 'Moodle connection successful',
          details: response.data,
        };
      } else {
        return {
          success: false,
          message: `Moodle connection failed: ${response.error}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Moodle connection error: ${error.message}`,
      };
    }
  }

  private async getMoodleUsers(connection: LmsConnection): Promise<LmsUser[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { token: connection.accessToken } } as any,
      `webservice/rest/server.php?wstoken=${connection.accessToken}&wsfunction=core_user_get_users&moodlewsrestformat=json&criteria[0][key]=email&criteria[0][value]=%`,
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Moodle users: ${response.error}`);
    }

    return response.data.users?.map(this.transformMoodleUser) || [];
  }

  private async getMoodleCourses(connection: LmsConnection): Promise<LmsCourse[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { token: connection.accessToken } } as any,
      `webservice/rest/server.php?wstoken=${connection.accessToken}&wsfunction=core_course_get_courses&moodlewsrestformat=json`,
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Moodle courses: ${response.error}`);
    }

    return response.data.map(this.transformMoodleCourse);
  }

  private async getMoodleEnrollments(connection: LmsConnection): Promise<LmsEnrollment[]> {
    // Moodle enrollments are typically fetched per course
    // This is a simplified implementation
    return [];
  }

  // Blackboard-specific methods
  private async testBlackboardConnection(connection: LmsConnection): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const response = await this.apiGatewayService.makeApiCall(
        { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { accessToken: connection.accessToken } } as any,
        'users/me',
        'GET'
      );

      if (response.success) {
        return {
          success: true,
          message: 'Blackboard connection successful',
          details: response.data,
        };
      } else {
        return {
          success: false,
          message: `Blackboard connection failed: ${response.error}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Blackboard connection error: ${error.message}`,
      };
    }
  }

  private async getBlackboardUsers(connection: LmsConnection): Promise<LmsUser[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { accessToken: connection.accessToken } } as any,
      'users',
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Blackboard users: ${response.error}`);
    }

    return response.data.results?.map(this.transformBlackboardUser) || [];
  }

  private async getBlackboardCourses(connection: LmsConnection): Promise<LmsCourse[]> {
    const response = await this.apiGatewayService.makeApiCall(
      { id: connection.id, configuration: { baseUrl: connection.baseUrl }, credentials: { accessToken: connection.accessToken } } as any,
      'courses',
      'GET'
    );

    if (!response.success) {
      throw new Error(`Failed to fetch Blackboard courses: ${response.error}`);
    }

    return response.data.results?.map(this.transformBlackboardCourse) || [];
  }

  private async getBlackboardEnrollments(connection: LmsConnection): Promise<LmsEnrollment[]> {
    return [];
  }

  // Data transformation methods
  private transformCanvasUser(data: any): LmsUser {
    return {
      id: data.id.toString(),
      email: data.email,
      name: data.name,
      firstName: data.first_name,
      lastName: data.last_name,
      roles: data.enrollments?.map((e: any) => e.role) || [],
    };
  }

  private transformCanvasCourse(data: any): LmsCourse {
    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description,
      code: data.course_code,
      startDate: data.start_at ? new Date(data.start_at) : undefined,
      endDate: data.end_at ? new Date(data.end_at) : undefined,
      status: data.workflow_state,
    };
  }

  private transformCanvasEnrollment(data: any): LmsEnrollment {
    return {
      id: data.id.toString(),
      userId: data.user_id.toString(),
      courseId: data.course_id.toString(),
      role: data.role,
      status: data.enrollment_state,
      enrolledAt: new Date(data.created_at),
    };
  }

  private transformMoodleUser(data: any): LmsUser {
    return {
      id: data.id.toString(),
      email: data.email,
      name: `${data.firstname} ${data.lastname}`,
      firstName: data.firstname,
      lastName: data.lastname,
      roles: data.roles || [],
    };
  }

  private transformMoodleCourse(data: any): LmsCourse {
    return {
      id: data.id.toString(),
      name: data.fullname,
      description: data.summary,
      code: data.shortname,
      startDate: data.startdate ? new Date(data.startdate * 1000) : undefined,
      endDate: data.enddate ? new Date(data.enddate * 1000) : undefined,
      status: data.visible ? 'active' : 'inactive',
    };
  }

  private transformBlackboardUser(data: any): LmsUser {
    return {
      id: data.id.toString(),
      email: data.contact?.email || data.userName,
      name: data.name?.formatted || data.userName,
      firstName: data.name?.given,
      lastName: data.name?.family,
      roles: data.roles || [],
    };
  }

  private transformBlackboardCourse(data: any): LmsCourse {
    return {
      id: data.id.toString(),
      name: data.name,
      description: data.description,
      code: data.courseId,
      status: data.availability?.available ? 'active' : 'inactive',
    };
  }

  private async getValidConnection(connectionId: string): Promise<LmsConnection> {
    const connection = await this.getConnection(connectionId);

    if (connection.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`LMS connection is not active: ${connection.status}`);
    }

    return connection;
  }

  private getUserSchema(): Record<string, any> {
    return {
      id: { required: true, type: 'string' },
      email: { required: true, type: 'string' },
      name: { required: true, type: 'string' },
      firstName: { required: false, type: 'string' },
      lastName: { required: false, type: 'string' },
      roles: { required: false, type: 'object' },
    };
  }

  private getCourseSchema(): Record<string, any> {
    return {
      id: { required: true, type: 'string' },
      name: { required: true, type: 'string' },
      description: { required: false, type: 'string' },
      code: { required: false, type: 'string' },
      startDate: { required: false, type: 'string' },
      endDate: { required: false, type: 'string' },
      status: { required: true, type: 'string' },
    };
  }

  private getEnrollmentSchema(): Record<string, any> {
    return {
      id: { required: true, type: 'string' },
      userId: { required: true, type: 'string' },
      courseId: { required: true, type: 'string' },
      role: { required: true, type: 'string' },
      status: { required: true, type: 'string' },
      enrolledAt: { required: true, type: 'string' },
    };
  }

  private async logLmsEvent(
    connectionId: string,
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const log = this.logRepository.create({
      integrationId: connectionId,
      level,
      category,
      message,
      metadata,
    });

    await this.logRepository.save(log);
  }
}
