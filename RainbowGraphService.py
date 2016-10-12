from flask import Flask, request, render_template, jsonify
from flask_api import status
from flask_cors import CORS, cross_origin
import uuid
import json
import xlrd
import numpy as np
import csv
import logging

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

configTable = {}


@app.route('/file-upload', methods=['POST'])
@cross_origin()
def file_upload():
    file = request.files['file']
    color_scheme = "5b"
    #check type of the files, find a way to check the header
    if file.filename.endswith(".csv"):
        #log the headers
        header1 = file.readline()
        header2 = file.readline()
        instructor_logger.info(header1)
        instructor_logger.info(header2)

        #check if this is CPR data file
        if "Assignment =" in header1 and "Time =" in header2:
            higher_primary_value_better = True
            primary_value_label = "Average Rate"
            secondary_value_label =	"Controversy"
            values_label = "Rating"
            y_axis_label =	"Average Rate"
            x_axis_label =	"Students"
            best = 10
            worst = 0
            color_scheme = "10b"
            reader = csv.reader(file, dialect="excel")

            cpr_data = list(reader)

            authors_scores = {}
            prev_author = None
            prev_author_name = None
            current_author_scores = []
            list_of_author_json_conf = []
            last_self_review_score = 0


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
                    elif prev_author != None:
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
                        #current_author_scores.append(last_self_review_score)

                        element_prev_author = {
                            "first_name": firstname,
                            "last_name": lastname,
                            "column_url": "",
                            "primary_value": float(primary_val),
                            "secondary_value": stdev,
                            "values": current_author_scores
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
        if data_sheet.cell(4,0).value == "Paper Author" and data_sheet.cell(4,1).value == "Reviewer":

            higher_primary_value_better = True
            primary_value_label = "Average Rate"
            secondary_value_label =	"Controversy"
            values_label = "Rating"
            y_axis_label =	"Average Rate"
            x_axis_label =	"Students"
            best = 7
            worst = 0
            color_scheme = "7b"

            authors_scores={}
            list_of_author_json_conf = []

            prev_author = None
            current_author_scores = []
            peer_given_holistic_score = {}
            for row in range(5, data_sheet.nrows):
                author = data_sheet.cell(row,0).value
                reviewer = data_sheet.cell(row,1).value

                if authors_scores.get(author) == None :
                    authors_scores[author] = {}

                #average scores all dimensions
                divider = 0
                score_sum = 0
                for col in range(2, data_sheet.ncols):
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

            #find the relevant columns
            fname_col = 0
            lname_col = 0
            rank_avg_col = 0
            rank_std_dev = 0
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
                elif data_sheet.cell(0, col).value.startswith("RankStuAr_"):
                    if data_sheet.cell(0, col).value.split("_")[1].isdigit():
                        review_cols.append(col)


            #fetch the relevant data per row, append them to list_of_author_json_conf
            list_of_author_json_conf = []
            for row in range(1, data_sheet.nrows):
                current_author_scores = []
                avg = 0
                std = 0

                if data_sheet.cell(row, rank_avg_col).value != '':
                    avg = float(data_sheet.cell(row, rank_avg_col).value)
                if data_sheet.cell(row, rank_std_dev).value != '':
                    std = float(data_sheet.cell(row, rank_std_dev).value)

                for i in range(0, len(review_cols)):
                    if data_sheet.cell(row, review_cols[i]).value != '':
                        if (best > worst and float(data_sheet.cell(row, review_cols[i]).value)>=worst) or \
                                worst > best and float(data_sheet.cell(row, review_cols[i]).value)>=best:
                            current_author_scores.append(float(data_sheet.cell(row, review_cols[i]).value))

                current_author_scores = sorted(current_author_scores)

                element_prev_author = {
                        "first_name": data_sheet.cell(row, fname_col).value,
                        "last_name": data_sheet.cell(row, lname_col).value,
                        "column_url": "",
                        "primary_value": avg,
                        "secondary_value": std,
                        "values": current_author_scores
                    }
                list_of_author_json_conf.append(element_prev_author)
        else:
            debug_logger.error("someone uploaded an xlsx file")
            return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    else:
        debug_logger.error("someone uploaded unknown file (" + file.filename + ")" )
        return jsonify(error="Uploaded file is currently not supported"), status.HTTP_415_UNSUPPORTED_MEDIA_TYPE

    data = sorted(list_of_author_json_conf, key=lambda k: k['primary_value'], reverse=higher_primary_value_better)

    config = {
        "metadata": {
                    "primary-value-label": primary_value_label,
                    "higher_primary_value_better": higher_primary_value_better,
                    "values-label": values_label,
                    "higher_values_better": False,
                    "best-value-possible": best,
                    "worst-value-possible": worst,
                    "y-axis-label": y_axis_label,
                    "x-axis-label": x_axis_label,
                    "color-scheme": color_scheme,
                    "secondary-value-label": secondary_value_label
            },
            "data": data
        }

    return jsonify([config]), status.HTTP_200_OK

@app.route('/instructor', methods=['GET'])
@cross_origin()
def instructor():
    #check type of the files
    return render_template('instructor.html')

@app.route('/configure', methods=['GET', 'POST'])
@cross_origin()
def index():
    if request.method == 'GET':
        return render_template('input_form.html')

    try:
        with open('configTable.json', 'r') as f:
            configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
    except:
        configTable = {}

    id = uuid.uuid4();
    configTable[id.urn[9:]] = request.json

    with open('configTable.json', 'w+') as f:
        json.dump(configTable, f)

    return jsonify(url="http://peerlogic.csc.ncsu.edu/rainbowgraph/viz/" + id.urn[9:])
    #return jsonify(url="http://127.0.0.1:3005/viz/" + id.urn[9:])

@app.route('/viz/<id>', methods=['GET', 'DELETE'])
@cross_origin()
def visualize(id):

 # load from file:
 try:
   with open('configTable.json', 'r+') as f:
       configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
 except ValueError:
   configTable = {}
 config = configTable.get(id)

 if request.method == 'DELETE':
    f.close()
    configTable.pop(id, None)
    with open('configTable.json', 'w+') as f:
        json.dump(configTable, f)
    return "", status.HTTP_200_OK
 else:
     if config == None:
         return jsonify(error="Shoot.. I couldn't find the config data")
     else:
         return render_template('index.html', json_data = json.dumps(config))



if __name__ == '__main__':
    #app.run(host='127.0.0.1', port=3005, threaded=True)
    app.run(host='0.0.0.0', port=3005, threaded=True)
