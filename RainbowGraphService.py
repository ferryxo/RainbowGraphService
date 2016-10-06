from flask import Flask, request, render_template, jsonify
from flask.ext.api import status
from flask_cors import CORS, cross_origin
import uuid
import json
import xlrd
import openpyxl
import numpy as np

app = Flask(__name__)
CORS(app)

configTable = {}


@app.route('/file-upload', methods=['POST'])
@cross_origin()
def file_upload():

    file = request.files['file']

    #check type of the files, find a way to check the header
    if file.filename.endswith(".csv"):
        print("handle csv")

    elif file.filename.endswith(".xls"):
        print("handle .xsl")
        book = xlrd.open_workbook(file_contents=file.read())
        data_sheet = book.sheet_by_index(0)
        cell00 = data_sheet.cell(0,0)  # 1st row

        if data_sheet.cell(4,0).value == "Paper Author" and data_sheet.cell(4,1).value == "Reviewer":
            #handle sword data

            authors_scores={}
            list_of_author = []

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
                    element_prev_author = {
                        "first_name": prev_author,
                        "last_name": "",
                        "column_url": "",
                        "primary_value": np.mean(current_author_scores),
                        "secondary_value": np.std(current_author_scores),
                        "values": current_author_scores
                    }
                    list_of_author.append(element_prev_author)
                    current_author_scores = [authors_scores[author][reviewer]]
                prev_author = author

        data = sorted(list_of_author, key=lambda k: k['primary_value'])

        config = {
            "metadata": {
                        "primary-value-label": "rate average",
                        "higher_primary_value_better": False,
                        "values-label": "ranks",
                        "higher_values_better": False,
                        "best-value-possible": 1,
                        "worst-value-possible": 7,
                        "y-axis-label": "Rate Average",
                        "x-axis-label": "Students",
                        "color-scheme": "5b",
                        "secondary-value-label": "variance"
                },
                "data": data
        }

        return jsonify([config]), status.HTTP_200_OK


    elif file.filename.endswith(".xlsx"):
        print("handle .xlsx")







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

    return jsonify(url="http://localhost:3005/viz/" + id.urn[9:])

@app.route('/viz/<id>', methods=['GET'])
@cross_origin()
def visualize(id):
 # load from file:
 try:
   with open('configTable.json', 'r') as f:
       configTable = json.load(f)
    # if the file is empty the ValueError will be thrown
 except ValueError:
   configTable = {}
 config = configTable.get(id)

 if config == None:
     return jsonify(error="Shoot.. I couldn't find the config data")
 else:
    return render_template('index.html', json_data = json.dumps(config))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3005, threaded=True)
