# app/routes/attendance_routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime, date
from sqlalchemy import and_, func
from app import db
from app.models import Attendance, Employee
import logging

from flask_cors import CORS

attendance_bp = Blueprint('attendance', __name__)
CORS(attendance_bp)
logger = logging.getLogger(__name__)


def find_employee(data_or_args, current_user_id=None):
    """
    Robustly find an employee.
    Priority 1: Match by email (prevents id collisions between login table and employees table)
    Priority 2: Match by string employee_id (e.g. 'EMP001')
    Priority 3: Match by integer primary key id if email is not provided
    """
    employee = None
    email = data_or_args.get('email')
    emp_id = data_or_args.get('employee_id')

    # 1. Match by email first (most accurate for user account lookup)
    if email:
        employee = Employee.query.filter_by(email=email).first()

    # 2. Match by string employee_id (e.g. 'EMP001')
    if not employee and emp_id:
        employee = Employee.query.filter_by(employee_id=str(emp_id)).first()

    # 3. Match by numeric primary key ID
    if not employee and emp_id:
        try:
            employee = db.session.get(Employee, int(emp_id))
        except (ValueError, TypeError):
            employee = None

    # 4. Fallback to JWT user identity
    if not employee and current_user_id:
        employee = Employee.query.filter_by(id=current_user_id).first()

    return employee


# ✅ Check In - Simple check-in without location/device
@attendance_bp.route('/check-in', methods=['POST'])
def check_in():
    """Employee check-in - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        logger.info(f"Check-in request data: {data}")
        
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            logger.info(f"JWT Identity: {current_user_id}")
        except:
            pass
        
        employee = find_employee(data, current_user_id)
        
        if not employee:
            logger.error(f"Employee not found. Data: {data}, Current User ID: {current_user_id}")
            all_employees = Employee.query.all()
            return jsonify({
                'error': 'Employee not found. Please provide employee_id or email in request body.',
                'debug_employees_count': len(all_employees),
                'received_data': data
            }), 404
        
        today = date.today()
        
        # Query today's attendance record
        existing_attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        # Create or update attendance record (allows re-checking in multiple times per day)
        if existing_attendance:
            attendance = existing_attendance
            attendance.check_in_time = datetime.now()
            attendance.check_out_time = None  # Reset check-out for new punch session
            attendance.total_hours = 0.0
            attendance.overtime = 0.0
            attendance.status = 'present'
        else:
            attendance = Attendance(
                employee_id=employee.id,
                date=today,
                check_in_time=datetime.now(),
                status='present'
            )
            db.session.add(attendance)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Check-in successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-in error: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'error': f"Internal server error: {str(e)}"}), 500


# ✅ Check Out - Simple check-out without location/device
@attendance_bp.route('/check-out', methods=['PUT'])
def check_out():
    """Employee check-out - Simple version"""
    try:
        data = request.get_json() or {}
        current_user_id = None
        
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee = find_employee(data, current_user_id)
        
        if not employee:
            return jsonify({'error': 'Employee not found. Please provide employee_id or email in request body.'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if not attendance or not attendance.check_in_time:
            return jsonify({'error': 'No check-in record found for today. Please check in first.'}), 404
        
        # Set or update check-out time
        attendance.check_out_time = datetime.now()
        
        # Calculate total hours
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
            else:
                attendance.overtime = 0.0
        
        attendance.status = 'present'
        db.session.commit()
        
        return jsonify({
            'message': 'Check-out successful',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Check-out error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Get today's attendance for current user
@attendance_bp.route('/today', methods=['GET'])
def get_today_attendance():
    """Get today's attendance for current user"""
    try:
        current_user_id = None
        
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee = find_employee(request.args, current_user_id)
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        today = date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            )
        ).first()
        
        if attendance:
            return jsonify(attendance.to_dict()), 200
        else:
            return jsonify({
                'employee_id': employee.id,
                'employee_name': employee.full_name,
                'date': today.isoformat(),
                'check_in_time': None,
                'check_out_time': None,
                'status': 'not_started',
                'total_hours': 0
            }), 200
            
    except Exception as e:
        logger.error(f"Get today's attendance error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get attendance history for current user
@attendance_bp.route('/history', methods=['GET'])
def get_attendance_history():
    """Get attendance history for current user"""
    try:
        current_user_id = None
        
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee = find_employee(request.args, current_user_id)
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        # Get query parameters for filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 30, type=int)
        
        query = Attendance.query.filter(Attendance.employee_id == employee.id)
        
        # Apply filters
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        # Order by date descending and limit
        attendances = query.order_by(Attendance.date.desc()).limit(limit).all()
        
        # Calculate summary
        total_present = sum(1 for a in attendances if a.status == 'present')
        total_absent = sum(1 for a in attendances if a.status == 'absent')
        total_late = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        total_overtime = sum(a.overtime or 0 for a in attendances)
        
        return jsonify({
            'attendances': [a.to_dict() for a in attendances],
            'summary': {
                'total_days': len(attendances),
                'present': total_present,
                'absent': total_absent,
                'late': total_late,
                'total_hours': round(total_hours, 2),
                'total_overtime': round(total_overtime, 2)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get attendance history error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get monthly summary for dashboard
@attendance_bp.route('/monthly-summary', methods=['GET'])
def get_monthly_summary():
    """Get monthly attendance summary"""
    try:
        current_user_id = None
        
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
        except:
            pass
        
        employee = find_employee(request.args, current_user_id)
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
        
        year = request.args.get('year', datetime.now().year, type=int)
        month = request.args.get('month', datetime.now().month, type=int)
        
        # Get attendance for the month
        attendances = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                func.year(Attendance.date) == year,
                func.month(Attendance.date) == month
            )
        ).all()
        
        # Calculate statistics
        total_days = len(attendances)
        present_days = sum(1 for a in attendances if a.status == 'present')
        absent_days = sum(1 for a in attendances if a.status == 'absent')
        late_days = sum(1 for a in attendances if a.status == 'late')
        total_hours = sum(a.total_hours or 0 for a in attendances)
        
        return jsonify({
            'year': year,
            'month': month,
            'statistics': {
                'total_days': total_days,
                'present': present_days,
                'absent': absent_days,
                'late': late_days,
                'attendance_rate': round((present_days / total_days * 100) if total_days > 0 else 0, 2),
                'total_hours': round(total_hours, 2)
            },
            'attendances': [a.to_dict() for a in attendances]
        }), 200
        
    except Exception as e:
        logger.error(f"Get monthly summary error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Get all employees for attendance tracking (Admin)
@attendance_bp.route('/employees', methods=['GET'])
def get_employees():
    """Get list of employees for attendance tracking"""
    try:
        employees = Employee.query.all()
        
        logger.info(f"Total employees in database: {len(employees)}")
        
        return jsonify({
            'total_employees': len(employees),
            'employees': [{
                'id': e.id,
                'employee_id': e.employee_id,
                'full_name': e.full_name,
                'email': e.email,
                'department': e.department,
                'designation': e.designation
            } for e in employees]
        }), 200
        
    except Exception as e:
        logger.error(f"Get employees error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Update attendance record (Admin only)
@attendance_bp.route('/update/<int:attendance_id>', methods=['PUT'])
def update_attendance(attendance_id):
    """Update attendance record (admin only)"""
    try:
        data = request.get_json()
        
        attendance = db.session.get(Attendance, attendance_id)
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
        
        # Update fields
        if 'check_in_time' in data:
            attendance.check_in_time = datetime.fromisoformat(data['check_in_time'])
        if 'check_out_time' in data:
            attendance.check_out_time = datetime.fromisoformat(data['check_out_time'])
        if 'status' in data:
            attendance.status = data['status']
        if 'notes' in data:
            attendance.notes = data['notes']
        
        # Recalculate hours if times updated
        if attendance.check_in_time and attendance.check_out_time:
            time_diff = attendance.check_out_time - attendance.check_in_time
            attendance.total_hours = round(time_diff.total_seconds() / 3600, 2)
            
            standard_hours = 8
            if attendance.total_hours > standard_hours:
                attendance.overtime = round(attendance.total_hours - standard_hours, 2)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Attendance updated successfully',
            'data': attendance.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Update attendance error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ✅ Company Summary for Admin (Total, Present, Absent, On Leave, Today Summary Details)
@attendance_bp.route('/summary', methods=['GET'])
def get_attendance_summary():
    """Get overall company attendance stats and detailed today's summary for Admin"""
    try:
        today = date.today()
        all_employees = Employee.query.all()
        total_employees = len(all_employees)
        
        # Fetch today's attendance records for all employees
        today_records = Attendance.query.filter(Attendance.date == today).all()
        attendance_map = {att.employee_id: att for att in today_records}
        
        present_count = 0
        on_leave_count = 0
        absent_count = 0
        
        summary_list = []
        on_leave_list = []
        
        for emp in all_employees:
            att = attendance_map.get(emp.id)
            if att:
                status = att.status or ('present' if att.check_in_time else 'absent')
                check_in_time = att.check_in_time.isoformat() if att.check_in_time else None
                check_out_time = att.check_out_time.isoformat() if att.check_out_time else None
                total_hours = att.total_hours or 0.0
                notes = att.notes
                att_id = att.id
            else:
                status = 'absent'
                check_in_time = None
                check_out_time = None
                total_hours = 0.0
                notes = None
                att_id = None
                
            if status == 'on_leave':
                on_leave_count += 1
            elif status in ['present', 'late'] or check_in_time:
                present_count += 1
            else:
                absent_count += 1
                
            item = {
                'id': emp.id,
                'employee_id': emp.employee_id,
                'full_name': emp.full_name,
                'email': emp.email,
                'department': emp.department or 'N/A',
                'designation': emp.designation or 'N/A',
                'check_in_time': check_in_time,
                'check_out_time': check_out_time,
                'total_hours': total_hours,
                'status': status,
                'notes': notes,
                'attendance_id': att_id
            }
            
            summary_list.append(item)
            if status == 'on_leave':
                on_leave_list.append(item)
                
        return jsonify({
            'total_employees': total_employees,
            'present_employees': present_count,
            'absent_employees': absent_count,
            'on_leave_employees': on_leave_count,
            'today_summary': summary_list,
            'employees_on_leave': on_leave_list
        }), 200
    except Exception as e:
        logger.error(f"Error fetching summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ✅ Mark Leave / Update Status (Admin)
@attendance_bp.route('/mark-leave', methods=['POST'])
def mark_leave():
    """Mark an employee as on leave, present, or absent for today or a specific date"""
    try:
        data = request.get_json() or {}
        emp_id = data.get('employee_id')
        target_date_str = data.get('date')
        notes = data.get('notes', '')
        status = data.get('status', 'on_leave')
        
        if not emp_id:
            return jsonify({'error': 'Employee ID is required'}), 400
            
        employee = Employee.query.filter(
            (Employee.id == emp_id) | (Employee.employee_id == str(emp_id))
        ).first()
        
        if not employee:
            return jsonify({'error': 'Employee not found'}), 404
            
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date() if target_date_str else date.today()
        
        attendance = Attendance.query.filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == target_date
            )
        ).first()
        
        if attendance:
            attendance.status = status
            if notes:
                attendance.notes = notes
            if status == 'on_leave':
                attendance.check_in_time = None
                attendance.check_out_time = None
                attendance.total_hours = 0.0
        else:
            attendance = Attendance(
                employee_id=employee.id,
                date=target_date,
                status=status,
                notes=notes
            )
            db.session.add(attendance)
            
        db.session.commit()
        return jsonify({
            'message': f"Employee marked as {status.replace('_', ' ')}",
            'data': attendance.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error marking leave: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


