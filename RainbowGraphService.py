from flask import Flask, request, render_template, jsonify, redirect, url_for
from flask_api import status
from flask_cors import CORS, cross_origin

import uuid
import json
import xlrd
import numpy as np
import csv
import logging

import sqlite3 as sqllite
import sys
reload(sys)
sys.setdefaultencoding('utf8')
import yaml
#from urlparse import urlparse

formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')

# first file logger
instructor_logger = logging.getLogger('instructor_logger')
hdlr_1 = logging.FileHandler('instructor.log')
hdlr_1.setFormatter(formatter)
instructor_logger.addHandler(hdlr_1)
instructor_logger.setLevel(logging.INFO)

# second file logger
debug_logger = logging.getLogger('debug_logger')
hdlr_2 = logging.FileHandler('debug.log')
hdlr_2.setFormatter(formatter)
debug_logger.addHandler(hdlr_2)
debug_logger.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)

global cfg
with open("config_file.yml", 'r') as ymlfile:
    cfg = yaml.load(ymlfile)

configTable = {}
cur = None
con = None

def setup_sql_lite_db():
    try:

        global con
        con = sqllite.connect('config_json.db', check_same_thread=False)
        global cur
        cur = con.cursor()
        #cur.execute('DROP TABLE IF EXISTS Comment')
        sql = "CREATE TABLE IF NOT EXISTS Config (" \
              "    id VARCHAR, " \
              "    json TEXT)"
        cur.execute(sql)
        con.commit()

    except sqllite.Error, e:
        print "Error %s:" % e.args[0]
        sys.exit(1)

@app.route('/')
def index():
    return redirect('developer')

def add_mobius_crit_comparer(group_members_ranks, list_of_author_json_conf, is_last_group):
    team_members_json = list_of_author_json_conf[-len(group_members_ranks):] if is_last_group else list_of_author_json_conf[-len(group_members_ranks)-1:len(group_members_ranks)]

    member_index = 0
    for member in team_members_json:
        vector = []
        reviewer_index = 0
        for rank in group_members_ranks[member['student_id']]:
            #reviewer_index = reviewer_index - len(team_members_json) if reviewer_index > len(team_members_json) else reviewer_index
            if rank != '':
                crit_id = team_members_json[reviewer_index]['student_id']
                crit_peers = [s['student_id'] for s in team_members_json if s['student_id'] != crit_id]

                vector_element = {
                    "rank": rank,
                    "critic_id": crit_id,
                    "critic_peers": crit_peers
                }
                vector.append(vector_element)
            reviewer_index += 1
        member_index += 1
        member['critic_comparer_vector'] = vector

    return list_of_author_json_conf

#TODO refactor exctract each file processing to a method
@app.route('/file-upload', methods=['POST'])
@cross_origin()
def file_upload():
    file = request.files['file']
    color_scheme = "5b"
    sas_val = "yes"
    critic_comparer_flag = "no"

    #check type of the files, find a way to check the header
    if file.filename.endswith(".csv"):
        #log the headers
        header1 = file.readline()
        header2 = file.readline()
        instructor_logger.info(header1)
        instructor_logger.info(header2)

        #check if this is CPR data file
        if "Assignment =" in header1 and "Time =" in header2:
            #setup metadata for CPR
            higher_primary_value_better = True
            primary_value_label = "Average Rate"
            secondary_value_label =	"Controversy"
            values_label = "Rating"
            y_axis_label =	"Average Rate"
            x_axis_label =	"Students"
            sas_val = "yes"
            critic_comparer_flag = "no"
            best = 10
            worst = 0
            color_scheme = "11b"
            reader = csv.reader(file, dialect="excel")

            cpr_data = list(reader)

            authors_scores = {}
            prev_author = None
            prev_author_name = None
            current_author_scores = []
            list_of_author_json_conf = []
            last_self_review_score = 0
            prev_primary_val = 0;

            #find the last row in this file. CPR data file is inconsistent it may contain empty fields.
            last_row = len(cpr_data[0])
            for i in range(len(cpr_data[0])-1,0, -1):
                if cpr_data[0][i] == '':
                    last_row-=1;
                else:
                    break


            for row in range(1, len(cpr_data)):
                author_id = cpr_data[row][0]
                author_name = cpr_data[row][2]
                reviewer = cpr_data[row][4]
                cpi = cpr_data[row][5]
                current_score = cpr_data[row][last_row-2]
                primary_val = cpr_data[row][3].split("/")[0]


                if reviewer != '':
                    #handle peer assessment scores
                    if author_id == prev_author or prev_author == None:
                        #add this reviewer and the score to this author
                        current_author_scores.append(float(current_score))
                        prev_primary_val = primary_val
                    elif prev_author != None and author_id != prev_author:
                        #calculate the avg score & standard dev. for this author
                        authors_scores[prev_author] = current_author_scores

                        if "," in prev_author_name:
                            firstname = prev_author_name.split(",")[1] if len(prev_author_name.split(","))>1 else "-"
                            lastname = prev_author_name.split(",")[0]
                        else:
                            firstname = prev_author_name.split(" ")[1] if len(prev_author_name.split(" "))>1 else "-"
                            lastname = prev_author_name.split(" ")[0]

                        current_author_scores = sorted(current_author_scores, reverse=True)
                        stdev = np.std(current_author_scores)
                        #add self assessment score to the prev_author
                        #TODO: check how the positions of the bars are determined. this seems to mess up the rendering
                        current_author_scores.insert(0, last_self_review_score)

                        element_prev_author = {
                            "first_name": firstname,
                            "last_name": lastname,
                            "column_url": "",
                            "primary_value": float(prev_primary_val),
                            "secondary_value": stdev,
                            "values": current_author_scores,
                            "self_assess_value": last_self_review_score
                        }

                        list_of_author_json_conf.append(element_prev_author)
                        current_author_scores = [float(current_score)]
                        last_self_review_score = 0
                else:
                    #store self assessment score
                    last_self_review_score = float(current_score)

                prev_author = author_id
                prev_author_name = author_name
        else:
            debug_logger.error("someone uploaded an unsupported csv file")
            return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    elif file.filename.endswith(".xls"):

        book = xlrd.open_workbook(file_contents=file.read())
        data_sheet = book.sheet_by_index(0)

        #log the headers
        header1 = data_sheet.cell(0,0)  # 1st row
        instructor_logger.info(header1)
        header1 = data_sheet.cell(2,0)  # 2nd row
        instructor_logger.info(header1)
        header1 = data_sheet.cell(3,0)  # 3rd row
        instructor_logger.info(header1)

        #check if this is perceptive / sword data file
        if data_sheet.cell(4,0).value == "Paper Author" :

            reviewer_col = 1
            start_score_col = 2

            if data_sheet.cell(4,2).value == "Reviewer":
                reviewer_col = 2
                start_score_col = 4

            higher_primary_value_better = True
            primary_value_label = "Average Rate"
            secondary_value_label =	"Controversy"
            values_label = "Rating"
            y_axis_label =	"Average Rate"
            x_axis_label =	"Students"
            best = 7
            worst = 0
            color_scheme = "7b"
            sas_val = "no"
            critic_comparer_flag = "no"

            authors_scores={}
            list_of_author_json_conf = []

            prev_author = None
            current_author_scores = []
            peer_given_holistic_score = {}
            for row in range(5, data_sheet.nrows):
                author = data_sheet.cell(row, 0).value
                reviewer = data_sheet.cell(row, reviewer_col).value

                if authors_scores.get(author) == None :
                    authors_scores[author] = {}

                #average scores all dimensions
                divider = 0
                score_sum = 0
                for col in range(start_score_col, data_sheet.ncols):
                    if not data_sheet.cell(row, col).value == '':
                        score_sum += float(data_sheet.cell(row, col).value)
                        divider += 1

                authors_scores[author][reviewer] = score_sum / float(divider)

                if prev_author == author or prev_author == None:
                    current_author_scores.append(authors_scores[author][reviewer])
                elif prev_author != None:
                    current_author_scores = sorted(current_author_scores, reverse=True)
                    element_prev_author = {
                        "first_name": prev_author,
                        "last_name": "",
                        "column_url": "",
                        "primary_value": np.mean(current_author_scores),
                        "secondary_value": np.std(current_author_scores),
                        "values": current_author_scores
                    }
                    list_of_author_json_conf.append(element_prev_author)
                    current_author_scores = [authors_scores[author][reviewer]]
                prev_author = author
        else:
            debug_logger.error("someone uploaded an unsupported xls file")
            return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    elif file.filename.endswith(".xlsx"):
        book = xlrd.open_workbook(file_contents=file.read())
        data_sheet = book.sheet_by_index(0)
        #check if this is CPR file
        header1 = data_sheet.cell(0,0)  # 1st row

        if "Assignment =" in header1.value:
            #log the headers
            instructor_logger.info(header1.value)
            header1 = data_sheet.cell(1,0)  # 2nd row
            instructor_logger.info(header1.value)
            #TODO process CPR XLSX
        elif "AssignmentTitle" in header1.value and "CaseTitle" in data_sheet.cell(0,3).value: # MobiusSLIP

            primary_value_label = "Attainment"
            secondary_value_label =	"Controversy"
            values_label = "Rank"
            y_axis_label = "Attainment"
            x_axis_label = "Students"
            best = 1
            worst = 5
            color_scheme = "5b"
            higher_primary_value_better = True
            self_assess_flag = "yes"
            critic_comparer_flag = "yes"

            #find the relevant columns
            fname_col = 0
            lname_col = 0
            group_id_col = 0
            student_id_col = 0
            rank_avg_col = 0
            rank_std_dev = 0
            rank_self_assess_col = 0
            review_cols = []

            for col in range(0, data_sheet.ncols):
                if data_sheet.cell(0, col).value == "FirstName":
                    fname_col = col
                elif data_sheet.cell(0, col).value == "LastName":
                    lname_col = col
                elif data_sheet.cell(0, col).value == "ScrkStuSub_Attm":
                    rank_avg_col = col
                elif data_sheet.cell(0, col).value == "ScrkStuSub_Cont":
                    rank_std_dev = col
                elif data_sheet.cell(0, col).value == "GroupID":
                    group_id_col = col
                elif data_sheet.cell(0, col).value == "SystStudID":
                    student_id_col = col
                elif data_sheet.cell(0, col).value == "RankStuAr_S":
                    rank_self_assess_col = col
                elif data_sheet.cell(0, col).value.startswith("RankStuAr_"):
                    if data_sheet.cell(0, col).value.split("_")[1].isdigit():
                        review_cols.append(col)


            #fetch the relevant data per row, append them to list_of_author_json_conf
            list_of_author_json_conf = []

            #critic_comparer_data
            last_group_id = ""
            group_members_ranks = {}

            for row in range(1, data_sheet.nrows):

                current_author_scores = []
                avg = 0
                std = 0
                sas_val = 0
                student_id = ''

                if data_sheet.cell(row, student_id_col).value != '':
                    student_id = data_sheet.cell(row, student_id_col).value
                if data_sheet.cell(row, rank_avg_col).value != '':
                    avg = float(data_sheet.cell(row, rank_avg_col).value)
                if data_sheet.cell(row, rank_std_dev).value != '':
                    std = float(data_sheet.cell(row, rank_std_dev).value)
                if data_sheet.cell(row, rank_self_assess_col).value != '':
                    sas_val = float(data_sheet.cell(row, rank_self_assess_col).value)

                ordered_author_ranks = []
                for i in range(0, len(review_cols)):
                    ordered_author_ranks.append(data_sheet.cell(row, review_cols[i]).value)
                    if data_sheet.cell(row, review_cols[i]).value != '':
                        if (best > worst and float(data_sheet.cell(row, review_cols[i]).value)>=worst) or \
                                worst > best and float(data_sheet.cell(row, review_cols[i]).value)>=best:
                            current_author_scores.append(float(data_sheet.cell(row, review_cols[i]).value))


                current_author_scores = sorted(current_author_scores)

                element_prev_author = {
                        "first_name": data_sheet.cell(row, fname_col).value,
                        "last_name": data_sheet.cell(row, lname_col).value,
                        "column_url": "#",
                        "primary_value": avg,
                        "secondary_value": std,
                        "self_assess_value": sas_val,
                        "values": current_author_scores,
                        "student_id": student_id
                    }
                list_of_author_json_conf.append(element_prev_author)

                if data_sheet.cell(row, group_id_col).value != '':
                    group_id = data_sheet.cell(row, group_id_col).value
                    #if row == 1 or last_group_id == group_id:

                    if last_group_id != group_id or row == data_sheet.nrows-1:
                        #if this is a last group, then we need to add the last student to the membership
                        if row == data_sheet.nrows-1:
                            group_members_ranks[student_id] = ordered_author_ranks
                        add_mobius_crit_comparer(group_members_ranks, list_of_author_json_conf, row == data_sheet.nrows-1)
                        group_members_ranks = {}
                    last_group_id = group_id
                    #this is a member of the next group
                    group_members_ranks[student_id] = ordered_author_ranks

        else:
            debug_logger.error("someone uploaded an xlsx file")
            return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    else:
        debug_logger.error("someone uploaded unknown file (" + file.filename + ")" )
        return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    data = sorted(list_of_author_json_conf, key=lambda k: k['primary_value'], reverse=higher_primary_value_better)

    config = {
        "metadata": {
                    "primary_value_label": primary_value_label,
                    "higher_primary_value_better": higher_primary_value_better,
                    "values_label": values_label,
                    "higher_values_better": False,
                    "best_value_possible": best,
                    "best_primary_value_possible":worst,
                    "worst_value_possible": worst,
                    "worst_primary_value_possible": best,
                    "y_axis_label": y_axis_label,
                    "x_axis_label": x_axis_label,
                    "color_scheme": color_scheme,
                    "secondary_value_label": secondary_value_label,
                    "self_assess_flag": self_assess_flag,
                    "critic_comparer_flag": critic_comparer_flag
            },
            "data": data
        }

    return jsonify([config]), status.HTTP_200_OK

@app.route('/instructor', methods=['GET'])
@cross_origin()
def instructor():
    return render_template('instructor.html')


@app.route('/developer', methods=['GET'])
@cross_origin()
def developer():
    return render_template('developer.html')

@app.route('/configure', methods=['POST'])
@cross_origin()
def configure():
    global cur, con
    json_conf = None

    try:
        json_conf = request.json
        id = uuid.uuid4();
        json_str = json.dumps(json_conf)
        cur.execute("INSERT INTO Config (id, json) VALUES (?, ?)", (str(id), json_str))
        con.commit()
        return jsonify(url=cfg['SERVER_URL'] + "/viz/" + id.urn[9:])
    except:
        return jsonify(error="I couldn't parse your JSON. Please make sure that your header contains 'content-type=application/json' and your json is valid"), status.HTTP_400_BAD_REQUEST

@app.route('/viz/<id>', methods=['GET', 'DELETE'])
@cross_origin()
def visualize(id):
 global cur, conn
 if request.method == 'DELETE':
    cur.execute("DELETE FROM Config WHERE id= ?", (id))
    con.commit()

    return "", status.HTTP_200_OK
 else:
     cur.execute("SELECT json FROM Config WHERE id= ?", (id))
     rows = cur.fetchall()

     # if config == None
     if len(rows) == 0:
         return jsonify(error="Shoot.. I couldn't find the config data")
     else:
         return render_template('visualization.html', json_data = rows[0])

if __name__ == '__main__':
    setup_sql_lite_db()
    #app.run(host='127.0.0.1', port=3005, threaded=True)
    app.run(host='0.0.0.0', port=3005, threaded=True)
